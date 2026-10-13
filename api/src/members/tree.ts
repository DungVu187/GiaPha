import { buildTree, type TreeData } from '../lib/tree.js';
import type { Db } from '../prisma/db.js';

// orderBy id: buildTree phụ thuộc thứ tự đầu vào ở ca hôn nhân chéo hiếm → phải ổn định.
export async function loadTree(db: Db): Promise<TreeData> {
  const [members, marriages] = await Promise.all([
    db.member.findMany({
      select: {
        id: true,
        fullName: true,
        searchName: true,
        generation: true,
        gender: true,
        isDeceased: true,
        birthOrder: true,
        birthYear: true,
        birthMonth: true,
        birthDay: true,
        deathYear: true,
        deathMonth: true,
        deathDay: true,
        deathCalendar: true,
        anniversaryDay: true,
        anniversaryMonth: true,
        anniversaryCalendar: true,
        burialPlace: true,
        avatarPath: true,
        fatherId: true,
        motherId: true,
      },
      orderBy: { id: 'asc' },
    }),
    db.marriage.findMany({
      select: { id: true, person1Id: true, person2Id: true, order: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  return buildTree(members, marriages);
}
