import type { DbClient } from '../prisma/db.js';
import type { DirectRelatives } from './permissions.js';

export async function spouseIdsOf(
  db: DbClient,
  memberId: number,
): Promise<number[]> {
  const marriages = await db.marriage.findMany({
    where: { OR: [{ person1Id: memberId }, { person2Id: memberId }] },
    select: { person1Id: true, person2Id: true },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
  return marriages.map((m) =>
    m.person1Id === memberId ? m.person2Id : m.person1Id,
  );
}

export async function loadDirectRelatives(
  db: DbClient,
  memberId: number,
): Promise<DirectRelatives | null> {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { fatherId: true, motherId: true },
  });
  if (!member) return null;
  const children = await db.member.findMany({
    where: { OR: [{ fatherId: memberId }, { motherId: memberId }] },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  return {
    selfId: memberId,
    fatherId: member.fatherId,
    motherId: member.motherId,
    spouseIds: await spouseIdsOf(db, memberId),
    childIds: children.map((c) => c.id),
  };
}

// UNION (không phải UNION ALL) để không lặp vô hạn kể cả khi dữ liệu lỗi có vòng;
// vòng có thể quay về chính memberId nên lọc nó ra.
export async function descendantIds(
  db: DbClient,
  memberId: number,
): Promise<number[]> {
  const rows = await db.$queryRaw<{ id: number }[]>`
    WITH RECURSIVE d(id) AS (
      SELECT id FROM "Member" WHERE "fatherId" = ${memberId} OR "motherId" = ${memberId}
      UNION
      SELECT m.id FROM "Member" m JOIN d ON m."fatherId" = d.id OR m."motherId" = d.id
    )
    SELECT id FROM d WHERE id <> ${memberId}`;
  return rows.map((r) => r.id);
}
