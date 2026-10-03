import { createHash, randomBytes } from 'node:crypto';
import type { Role } from '../generated/prisma/client.js';
import type { Db } from '../prisma/db.js';

export const SESSION_COOKIE = 'giapha_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = { id: number; username: string; role: Role };

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  db: Db,
  userId: number,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.session.create({
    data: { id: hashToken(token), userId, expiresAt },
  });
  return { token, expiresAt };
}

// ponytail: hạn cố định 30 ngày, không gia hạn trượt — thêm khi người dùng phàn nàn phải đăng nhập lại.
export async function validateSessionToken(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<SessionUser | null> {
  if (!token) return null;
  const id = hashToken(token);
  const session = await db.session.findUnique({
    where: { id },
    include: { user: { select: { id: true, username: true, role: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= now.getTime()) {
    await db.session.deleteMany({ where: { id } });
    return null;
  }
  return session.user;
}

export async function invalidateSession(db: Db, token: string): Promise<void> {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}

export async function invalidateUserSessions(
  db: Db,
  userId: number,
): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
