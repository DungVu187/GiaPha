import type { Role } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { newPasswordError, parseOptionalEmail } from '../auth/credentials.js';
import {
  hashPassword,
  MAX_PASSWORD_LENGTH,
  verifyPassword,
} from '../auth/password.js';
import { EMAIL_TAKEN } from '../auth/register-input.js';
import { hashToken } from '../auth/session.js';
import type { Db } from '../prisma/db.js';

export type AccountInfo = {
  username: string;
  email: string | null;
  role: Role;
  member: {
    id: number;
    fullName: string;
    generation: number;
    avatarPath: string | null;
  } | null;
};

export async function getAccount(db: Db, userId: number): Promise<AccountInfo> {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      username: true,
      email: true,
      role: true,
      member: {
        select: {
          id: true,
          fullName: true,
          generation: true,
          avatarPath: true,
        },
      },
    },
  });
}

type Errors = Record<string, string>;

export async function updateEmail(
  db: Db,
  userId: number,
  raw: unknown,
): Promise<{ ok: true; email: string | null } | { ok: false; errors: Errors }> {
  const parsed = parseOptionalEmail(raw);
  if (!parsed.ok) return { ok: false, errors: { email: parsed.error } };
  try {
    await db.user.update({
      where: { id: userId },
      data: { email: parsed.email },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      return { ok: false, errors: { email: EMAIL_TAKEN } };
    throw error;
  }
  return { ok: true, email: parsed.email };
}

/** Đổi mật khẩu của chính mình; xong thì xóa mọi phiên KHÁC (giữ phiên `currentToken`). */
export async function changePassword(
  db: Db,
  userId: number,
  currentToken: string,
  body: { currentPassword?: unknown; newPassword?: unknown },
): Promise<{ ok: true } | { ok: false; errors: Errors }> {
  const errors: Errors = {};
  const current = body.currentPassword;
  if (typeof current !== 'string' || !current)
    errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
  const newError = newPasswordError(body.newPassword);
  if (newError) errors.newPassword = newError;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const currentPassword = current as string;
  const next = body.newPassword as string;
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  // Chặn chuỗi khổng lồ trước argon2 như login.
  if (
    currentPassword.length > MAX_PASSWORD_LENGTH ||
    !(await verifyPassword(user.passwordHash, currentPassword))
  )
    return {
      ok: false,
      errors: { currentPassword: 'Mật khẩu hiện tại không đúng.' },
    };
  if (next.normalize('NFC') === currentPassword.normalize('NFC'))
    return {
      ok: false,
      errors: { newPassword: 'Mật khẩu mới phải khác mật khẩu hiện tại.' },
    };
  const passwordHash = await hashPassword(next);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash } }),
    db.session.deleteMany({
      where: { userId, id: { not: hashToken(currentToken) } },
    }),
  ]);
  return { ok: true };
}
