import { randomBytes } from 'node:crypto';
import type { Member, Prisma } from '../../src/generated/prisma/client.js';
import { createSession } from '../../src/auth/session.js';
import { normalizeFullName, toSearchName } from '../../src/lib/name.js';
import type { Db } from '../../src/prisma/db.js';

type MemberData = Partial<
  Omit<Prisma.MemberUncheckedCreateInput, 'searchName'>
>;

export function createMember(db: Db, data: MemberData = {}): Promise<Member> {
  const fullName = normalizeFullName(data.fullName ?? 'VŨ VĂN TEST');
  return db.member.create({
    data: {
      generation: 1,
      ...data,
      fullName,
      searchName: toSearchName(fullName),
    },
  });
}

export function marry(db: Db, aId: number, bId: number) {
  const [person1Id, person2Id] = aId < bId ? [aId, bId] : [bId, aId];
  return db.marriage.create({ data: { person1Id, person2Id } });
}

export async function loginAs(
  db: Db,
  opts: { role?: 'ADMIN' | 'MEMBER'; memberId?: number | null } = {},
): Promise<{ cookie: string; userId: number }> {
  const user = await db.user.create({
    data: {
      username: `u_${randomBytes(6).toString('hex')}`,
      passwordHash: 'x',
      role: opts.role ?? 'MEMBER',
      memberId: opts.memberId ?? null,
    },
  });
  const { token } = await createSession(db, user.id);
  return { cookie: `giapha_session=${token}`, userId: user.id };
}
