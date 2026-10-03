import type { Db } from '../prisma/db.js';
import { hashPassword, verifyPassword } from './password.js';
import type { SessionUser } from './session.js';
import { normalizeUsername } from './username.js';

// Hash giả để thời gian phản hồi giống nhau dù user có tồn tại hay không.
let dummyHash: Promise<string> | undefined;

export async function authenticate(
  db: Db,
  usernameInput: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { username: normalizeUsername(usernameInput) },
  });
  if (!user) {
    dummyHash ??= hashPassword('khong-ton-tai-dummy');
    await verifyPassword(await dummyHash, password);
    return null;
  }
  if (!(await verifyPassword(user.passwordHash, password))) return null;
  return { id: user.id, username: user.username, role: user.role };
}
