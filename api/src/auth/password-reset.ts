import { randomBytes } from 'node:crypto';
import type { Mailer } from '../mail/mailer.js';
import { ServiceError } from '../members/member-service.js';
import type { Db } from '../prisma/db.js';
import { newPasswordError } from './credentials.js';
import { hashPassword } from './password.js';
import { hashToken } from './session.js';
import { normalizeUsername } from './username.js';

export const RESET_TTL_MS = 30 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_IDENTIFIER_LENGTH = 254;
const MAX_TOKEN_LENGTH = 100;
export const MAIL_FAILED = 'Không gửi được email, vui lòng thử lại sau.';

export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  return at < 0 ? `${email[0] ?? ''}•••` : `${email[0]}•••${email.slice(at)}`;
}

export type ResetRequestResult =
  | { kind: 'not-found' }
  | { kind: 'no-email'; username: string }
  | { kind: 'cooldown' }
  | { kind: 'sent'; maskedEmail: string; userId: number };

export async function requestPasswordReset(
  db: Db,
  identifier: string,
  mailer: Mailer,
  appUrl: string,
  now: Date = new Date(),
): Promise<ResetRequestResult> {
  const id = identifier.trim().toLowerCase();
  if (!id || id.length > MAX_IDENTIFIER_LENGTH) return { kind: 'not-found' };
  const user = await db.user.findFirst({
    where: { OR: [{ username: normalizeUsername(id) }, { email: id }] },
    select: { id: true, username: true, email: true },
  });
  if (!user) return { kind: 'not-found' };
  if (!user.email) return { kind: 'no-email', username: user.username };
  const recent = await db.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      createdAt: { gt: new Date(now.getTime() - RESEND_COOLDOWN_MS) },
    },
    select: { id: true },
  });
  if (recent) return { kind: 'cooldown' };
  const token = randomBytes(32).toString('base64url');
  const tokenId = hashToken(token);
  await db.passwordResetToken.create({
    data: {
      id: tokenId,
      userId: user.id,
      expiresAt: new Date(now.getTime() + RESET_TTL_MS),
      createdAt: now,
    },
  });
  const link = `${appUrl.replace(/\/+$/, '')}/reset-password?token=${token}`;
  try {
    await mailer({
      to: user.email,
      subject: 'Đặt lại mật khẩu — Gia phả họ Vũ',
      text: [
        `Chào ${user.username},`,
        '',
        `Có yêu cầu đặt lại mật khẩu cho tài khoản ${user.username} trên Gia phả họ Vũ.`,
        'Mở link sau để đặt mật khẩu mới (dùng được một lần, hết hạn sau 30 phút):',
        link,
        '',
        'Nếu bạn không yêu cầu, hãy bỏ qua thư này — mật khẩu của bạn không đổi.',
      ].join('\n'),
    });
  } catch {
    await db.passwordResetToken.deleteMany({ where: { id: tokenId } });
    throw new ServiceError(503, MAIL_FAILED);
  }
  return { kind: 'sent', maskedEmail: maskEmail(user.email), userId: user.id };
}

const tokenIdOf = (token: unknown): string | null =>
  typeof token === 'string' &&
  token.length > 0 &&
  token.length <= MAX_TOKEN_LENGTH
    ? hashToken(token)
    : null;

export async function checkResetToken(
  db: Db,
  token: unknown,
  now: Date = new Date(),
): Promise<{ username: string } | null> {
  const id = tokenIdOf(token);
  if (!id) return null;
  const row = await db.passwordResetToken.findFirst({
    where: { id, expiresAt: { gt: now } },
    select: { user: { select: { username: true } } },
  });
  return row ? { username: row.user.username } : null;
}

export async function confirmPasswordReset(
  db: Db,
  token: unknown,
  newPassword: unknown,
  now: Date = new Date(),
): Promise<
  | { ok: true; userId: number }
  | { ok: false; error: 'invalid' }
  | { ok: false; error: 'password'; message: string }
> {
  const message = newPasswordError(newPassword);
  if (message) return { ok: false, error: 'password', message };
  const id = tokenIdOf(token);
  if (!id) return { ok: false, error: 'invalid' };
  const row = await db.passwordResetToken.findFirst({
    where: { id, expiresAt: { gt: now } },
    select: { userId: true },
  });
  if (!row) return { ok: false, error: 'invalid' };
  const passwordHash = await hashPassword(newPassword as string);
  const used = await db.$transaction(async (tx) => {
    // Xóa đúng token còn hạn trước: hai lần bấm cùng lúc thì chỉ một lần thấy count = 1.
    const { count } = await tx.passwordResetToken.deleteMany({
      where: { id, expiresAt: { gt: now } },
    });
    if (count !== 1) return false;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.passwordResetToken.deleteMany({ where: { userId: row.userId } });
    await tx.session.deleteMany({ where: { userId: row.userId } });
    return true;
  });
  return used
    ? { ok: true, userId: row.userId }
    : { ok: false, error: 'invalid' };
}
