import type { DbClient } from '../prisma/db.js';
import { spouseIdsOf } from './relatives.js';

const MAX_STEPS = 10_000;

// null = không suy ra được, đời phải nhập tay.
export async function derivedGeneration(
  db: DbClient,
  memberId: number,
): Promise<number | null> {
  const m = await db.member.findUniqueOrThrow({
    where: { id: memberId },
    select: {
      father: { select: { generation: true } },
      mother: { select: { generation: true } },
    },
  });
  if (m.father) return m.father.generation + 1;
  if (m.mother) return m.mother.generation + 1;
  // Vợ/chồng ngoài họ: lấy đời của người phối ngẫu có bố hoặc mẹ trong DB (spec §3, D8).
  for (const spouseId of await spouseIdsOf(db, memberId)) {
    const s = await db.member.findUniqueOrThrow({
      where: { id: spouseId },
      select: { generation: true, fatherId: true, motherId: true },
    });
    if (s.fatherId !== null || s.motherId !== null) return s.generation;
  }
  return null;
}

async function dependentsOf(db: DbClient, memberId: number): Promise<number[]> {
  const children = await db.member.findMany({
    where: { OR: [{ fatherId: memberId }, { motherId: memberId }] },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  return [...children.map((c) => c.id), ...(await spouseIdsOf(db, memberId))];
}

// Không dùng tập "đã thăm": một người có thể phải tính lại khi bố/mẹ/vợ chồng đổi sau
// (vd. con của con gái và rể ngoài họ). Quan hệ không có vòng nên hội tụ; MAX_STEPS chặn dữ liệu lỗi.
export async function propagateGenerations(
  db: DbClient,
  startId: number,
): Promise<void> {
  const queue = await dependentsOf(db, startId);
  for (let steps = 0; queue.length > 0; steps++) {
    if (steps > MAX_STEPS)
      throw new Error('Không tính được đời: dữ liệu quan hệ có vòng lặp.');
    const id = queue.shift() as number;
    const derived = await derivedGeneration(db, id);
    if (derived === null) continue;
    const { generation } = await db.member.findUniqueOrThrow({
      where: { id },
      select: { generation: true },
    });
    if (derived === generation) continue;
    await db.member.update({ where: { id }, data: { generation: derived } });
    queue.push(...(await dependentsOf(db, id)));
  }
}
