import type { DbClient } from '../prisma/db.js';
import type { FieldErrors, GenderValue } from './member-input.js';
import { descendantIds } from './relatives.js';

// Thứ tự kiểm: chính mình → tồn tại → con cháu → giới tính.
async function checkParent(
  db: DbClient,
  memberId: number | null,
  parentId: number,
  expected: GenderValue,
  label: 'bố' | 'mẹ',
  descendants: () => Promise<number[]>,
): Promise<string | null> {
  if (memberId !== null && parentId === memberId)
    return `Không thể chọn chính mình làm ${label}.`;
  const parent = await db.member.findUnique({
    where: { id: parentId },
    select: { gender: true },
  });
  if (!parent) return `Không tìm thấy người được chọn làm ${label}.`;
  if ((await descendants()).includes(parentId))
    return `Không thể chọn con cháu của mình làm ${label}.`;
  if (parent.gender !== expected)
    return label === 'bố' ? 'Bố phải là nam.' : 'Mẹ phải là nữ.';
  return null;
}

export async function validateParents(
  db: DbClient,
  memberId: number | null,
  fatherId: number | null,
  motherId: number | null,
): Promise<FieldErrors> {
  let cached: number[] | undefined;
  const descendants = async () =>
    (cached ??= memberId === null ? [] : await descendantIds(db, memberId));
  const errors: FieldErrors = {};
  if (fatherId !== null) {
    const e = await checkParent(
      db,
      memberId,
      fatherId,
      'MALE',
      'bố',
      descendants,
    );
    if (e) errors.fatherId = e;
  }
  if (motherId !== null) {
    const e = await checkParent(
      db,
      memberId,
      motherId,
      'FEMALE',
      'mẹ',
      descendants,
    );
    if (e) errors.motherId = e;
  }
  return errors;
}

export async function validateSpouse(
  db: DbClient,
  memberId: number,
  spouseId: number,
): Promise<string | null> {
  if (spouseId === memberId) return 'Không thể kết hôn với chính mình.';
  const spouse = await db.member.findUnique({
    where: { id: spouseId },
    select: { id: true },
  });
  if (!spouse) return 'Không tìm thấy người được chọn.';
  if (
    (await descendantIds(db, memberId)).includes(spouseId) ||
    (await descendantIds(db, spouseId)).includes(memberId)
  ) {
    return 'Không thể chọn con cháu của mình làm vợ/chồng.';
  }
  const [person1Id, person2Id] =
    memberId < spouseId ? [memberId, spouseId] : [spouseId, memberId];
  const existing = await db.marriage.findUnique({
    where: { person1Id_person2Id: { person1Id, person2Id } },
  });
  return existing ? 'Hai người đã là vợ chồng.' : null;
}

export async function validateGenderChange(
  db: DbClient,
  memberId: number,
  gender: GenderValue | null,
): Promise<string | null> {
  if (
    gender !== 'MALE' &&
    (await db.member.count({ where: { fatherId: memberId } })) > 0
  ) {
    return 'Không thể đổi giới tính: người này đang là bố trong gia phả.';
  }
  if (
    gender !== 'FEMALE' &&
    (await db.member.count({ where: { motherId: memberId } })) > 0
  ) {
    return 'Không thể đổi giới tính: người này đang là mẹ trong gia phả.';
  }
  return null;
}
