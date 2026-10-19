import type { Role } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  EMAIL_INVALID,
  newPasswordError,
  parseOptionalEmail,
} from '../auth/credentials.js';
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

const CURRENT_PASSWORD_MISSING = 'Vui lòng nhập mật khẩu hiện tại.';
const CURRENT_PASSWORD_WRONG = 'Mật khẩu hiện tại không đúng.';

const hasCurrentPassword = (raw: unknown): raw is string =>
  typeof raw === 'string' && raw.length > 0;

/** Lỗi mật khẩu hiện tại (đã qua `hasCurrentPassword`), hoặc null nếu đúng. */
async function verifyCurrentPassword(
  db: Db,
  userId: number,
  currentPassword: string,
): Promise<string | null> {
  // Chặn chuỗi khổng lồ trước argon2 như login.
  if (currentPassword.length > MAX_PASSWORD_LENGTH)
    return CURRENT_PASSWORD_WRONG;
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return (await verifyPassword(user.passwordHash, currentPassword))
    ? null
    : CURRENT_PASSWORD_WRONG;
}

/** Đổi email của chính mình (cần mật khẩu hiện tại); xong thì hủy mọi link đặt lại mật khẩu. */
export async function updateEmail(
  db: Db,
  userId: number,
  body: { email?: unknown; currentPassword?: unknown },
): Promise<{ ok: true; email: string | null } | { ok: false; errors: Errors }> {
  const errors: Errors = {};
  // Thiếu khóa email là yêu cầu hỏng, không phải "xóa email" — chỉ "" / null mới xóa.
  const parsed: ReturnType<typeof parseOptionalEmail> =
    'email' in body
      ? parseOptionalEmail(body.email)
      : { ok: false, error: EMAIL_INVALID };
  if (!parsed.ok) errors.email = parsed.error;
  const current = body.currentPassword;
  if (!hasCurrentPassword(current))
    errors.currentPassword = CURRENT_PASSWORD_MISSING;
  if (!parsed.ok || !hasCurrentPassword(current)) return { ok: false, errors };
  const wrong = await verifyCurrentPassword(db, userId, current);
  if (wrong) return { ok: false, errors: { currentPassword: wrong } };
  try {
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { email: parsed.email } }),
      db.passwordResetToken.deleteMany({ where: { userId } }),
    ]);
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

/** Đổi mật khẩu của chính mình; xong thì xóa mọi phiên KHÁC (giữ phiên `currentToken`) và mọi link đặt lại. */
export async function changePassword(
  db: Db,
  userId: number,
  currentToken: string,
  body: { currentPassword?: unknown; newPassword?: unknown },
): Promise<{ ok: true } | { ok: false; errors: Errors }> {
  const errors: Errors = {};
  const current = body.currentPassword;
  if (!hasCurrentPassword(current))
    errors.currentPassword = CURRENT_PASSWORD_MISSING;
  const newError = newPasswordError(body.newPassword);
  if (newError) errors.newPassword = newError;
  if (!hasCurrentPassword(current) || newError) return { ok: false, errors };
  const next = body.newPassword as string;
  const wrong = await verifyCurrentPassword(db, userId, current);
  if (wrong) return { ok: false, errors: { currentPassword: wrong } };
  if (next.normalize('NFC') === current.normalize('NFC'))
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
    db.passwordResetToken.deleteMany({ where: { userId } }),
  ]);
  return { ok: true };
}
