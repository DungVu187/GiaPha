import type { Role } from '../generated/prisma/client.js';
import { newPasswordError } from '../auth/credentials.js';
import { hashPassword } from '../auth/password.js';
import type { SessionUser } from '../auth/session.js';
import { FORBIDDEN, INVALID, ServiceError } from '../members/member-service.js';
import type { Db } from '../prisma/db.js';

export const USER_NOT_FOUND = 'Không tìm thấy tài khoản.';
export const LAST_ADMIN =
  'Không thể hạ quyền Admin cuối cùng. Hãy cấp quyền Admin cho một tài khoản khác trước.';
export const RESET_OWN_PASSWORD =
  'Đổi mật khẩu của chính bạn ở trang Tài khoản của tôi.';
const ROLE_INVALID = 'Quyền không hợp lệ.';

export function requireAdmin(actor: SessionUser): void {
  if (actor.role !== 'ADMIN') throw new ServiceError(403, FORBIDDEN);
}

async function requireUser(db: Db, id: number) {
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, memberId: true },
  });
  if (!user) throw new ServiceError(404, USER_NOT_FOUND);
  return user;
}

// ponytail: trả hết, không phân trang — < ~300 tài khoản (P7 GĐ6, D11).
export function listUsers(db: Db) {
  return db.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      claimedAt: true,
      member: {
        select: {
          id: true,
          fullName: true,
          generation: true,
          avatarPath: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

export async function resetUserPassword(
  db: Db,
  actor: SessionUser,
  userId: number,
  newPassword: unknown,
): Promise<void> {
  requireAdmin(actor);
  if (userId === actor.id) throw new ServiceError(400, RESET_OWN_PASSWORD);
  const error = newPasswordError(newPassword);
  if (error) throw new ServiceError(400, INVALID, { newPassword: error });
  await requireUser(db, userId);
  const passwordHash = await hashPassword(newPassword as string);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash } }),
    db.session.deleteMany({ where: { userId } }),
    db.passwordResetToken.deleteMany({ where: { userId } }),
  ]);
}

// Trả memberId cũ (để log). Hồ sơ thành viên giữ nguyên.
export async function unlinkMember(
  db: Db,
  actor: SessionUser,
  userId: number,
): Promise<number | null> {
  requireAdmin(actor);
  const user = await requireUser(db, userId);
  await db.user.update({
    where: { id: userId },
    data: { memberId: null, claimedAt: null },
  });
  return user.memberId;
}

const ROLES: readonly unknown[] = ['ADMIN', 'MEMBER'];

export async function changeRole(
  db: Db,
  actor: SessionUser,
  userId: number,
  role: unknown,
): Promise<void> {
  requireAdmin(actor);
  if (!ROLES.includes(role))
    throw new ServiceError(400, INVALID, { role: ROLE_INVALID });
  await db.$transaction(async (tx) => {
    // Khóa mọi hàng Admin: hai Admin hạ nhau cùng lúc thì yêu cầu sau phải thấy số Admin đã giảm.
    const admins = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM "User" WHERE role = 'ADMIN' FOR UPDATE`;
    // Người thao tác có thể vừa bị hạ quyền sau khi guard đọc phiên.
    if (!admins.some((a) => a.id === actor.id))
      throw new ServiceError(403, FORBIDDEN);
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!target) throw new ServiceError(404, USER_NOT_FOUND);
    if (target.role === 'ADMIN' && role === 'MEMBER' && admins.length <= 1)
      throw new ServiceError(409, LAST_ADMIN);
    await tx.user.update({
      where: { id: userId },
      data: { role: role as Role },
    });
  });
}
