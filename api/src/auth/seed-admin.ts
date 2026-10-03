import type { Db } from '../prisma/db.js';
import { hashPassword, MIN_PASSWORD_LENGTH } from './password.js';
import { isValidUsername, normalizeUsername } from './username.js';

export async function seedAdmin(
  db: Db,
  usernameInput: string,
  password: string,
): Promise<{ created: boolean; user: { id: number; username: string } }> {
  const username = normalizeUsername(usernameInput);
  if (!isValidUsername(username))
    throw new Error(`ADMIN_USERNAME không hợp lệ: "${username}"`);
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`,
    );
  }
  const existing = await db.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (existing) return { created: false, user: existing };
  const user = await db.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
    },
    select: { id: true, username: true },
  });
  return { created: true, user };
}
