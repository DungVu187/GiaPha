import type { Prisma } from '../generated/prisma/client.js';
import { nextAnniversary, type NextAnniversary } from '../lib/anniversary.js';
import { normalizeFullName, toSearchName } from '../lib/name.js';
import type { SimpleDate } from '../lib/partial-date.js';
import type { Db, DbClient } from '../prisma/db.js';
import { detectImageType, removeAvatarFile, saveAvatarFile } from './avatar.js';
import {
  derivedGeneration,
  LOOP_ERROR,
  propagateGenerations,
} from './generation.js';
import {
  MAX_GENERATION,
  type FieldErrors,
  type MemberInput,
} from './member-input.js';
import {
  canCreateIndependentMember,
  canDeleteMember,
  canEditMember,
  type Actor,
} from './permissions.js';
import { loadDirectRelatives, spouseIdsOf } from './relatives.js';
import {
  validateGenderChange,
  validateParents,
  validateSpouse,
} from './relationship-rules.js';

export const FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này.';
export const NOT_FOUND = 'Không tìm thấy thành viên.';
export const INVALID = 'Dữ liệu không hợp lệ.';
const GENERATION_CONFLICT =
  'Không thể cập nhật đời: dữ liệu quan hệ có vòng lặp hoặc vượt giới hạn đời.';

export class ServiceError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
    readonly errors?: FieldErrors,
  ) {
    super(message);
  }
}

const invalid = (errors: FieldErrors) => new ServiceError(400, INVALID, errors);
const forbidden = () => new ServiceError(403, FORBIDDEN);
const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0;

export type RelationKind = 'FATHER' | 'MOTHER' | 'SPOUSE' | 'CHILD';

const SUMMARY_SELECT = {
  id: true,
  fullName: true,
  generation: true,
  gender: true,
  isDeceased: true,
  birthYear: true,
  birthMonth: true,
  birthDay: true,
  deathYear: true,
  deathMonth: true,
  deathDay: true,
  deathCalendar: true,
  avatarPath: true,
} as const satisfies Prisma.MemberSelect;

export type MemberSummary = Prisma.MemberGetPayload<{
  select: typeof SUMMARY_SELECT;
}>;
export type SpouseSummary = MemberSummary & {
  marriageId: number;
  order: number | null;
  note: string | null;
};
export type MemberDetail = MemberSummary & {
  birthOrder: number | null;
  deathLunarLeap: boolean;
  anniversaryDay: number | null;
  anniversaryMonth: number | null;
  anniversaryCalendar: 'SOLAR' | 'LUNAR' | null;
  burialPlace: string | null;
  note: string | null;
  fatherId: number | null;
  motherId: number | null;
  father: MemberSummary | null;
  mother: MemberSummary | null;
  spouses: SpouseSummary[];
  children: MemberSummary[];
  generationLocked: boolean;
  nextAnniversary: NextAnniversary | null;
  permissions: { canEdit: boolean; canDelete: boolean };
};
export type SearchResult = MemberSummary & {
  fatherName: string | null;
  motherName: string | null;
};

// Mọi thao tác ghi: một transaction; lỗi vòng lặp khi lan đời → 409 (rollback).
// Timeout rộng vì lan đời trên nhánh lớn chạy nhiều truy vấn.
async function write<T>(
  db: Db,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await db.$transaction(fn, { timeout: 30_000 });
  } catch (e) {
    if (e instanceof Error && e.message === LOOP_ERROR)
      throw new ServiceError(409, GENERATION_CONFLICT);
    throw e;
  }
}

// Dữ liệu ghi xuống DB từ MemberInput (không gồm đời và bố/mẹ — xử lý riêng).
function fieldsOf(input: MemberInput) {
  const fullName = normalizeFullName(input.fullName);
  return {
    fullName,
    searchName: toSearchName(fullName),
    gender: input.gender,
    birthOrder: input.birthOrder,
    birthYear: input.birth.year,
    birthMonth: input.birth.month,
    birthDay: input.birth.day,
    isDeceased: input.isDeceased,
    deathYear: input.death.year,
    deathMonth: input.death.month,
    deathDay: input.death.day,
    deathCalendar: input.deathCalendar,
    deathLunarLeap: input.deathLunarLeap,
    anniversaryDay: input.anniversary?.day ?? null,
    anniversaryMonth: input.anniversary?.month ?? null,
    anniversaryCalendar: input.anniversary?.calendar ?? null,
    burialPlace: input.burialPlace,
    note: input.note,
  };
}

async function requireExists(db: DbClient, id: number) {
  const m = await db.member.findUnique({ where: { id } });
  if (!m) throw new ServiceError(404, NOT_FOUND);
  return m;
}

async function requireCanEdit(
  db: DbClient,
  actor: Actor,
  targetId: number,
): Promise<void> {
  // Người thân của CHÍNH actor, không phải của target.
  const relatives =
    actor.memberId === null
      ? null
      : await loadDirectRelatives(db, actor.memberId);
  if (!canEditMember(actor, targetId, relatives)) throw forbidden();
}

async function setGeneration(db: DbClient, id: number, generation: number) {
  if (generation > MAX_GENERATION)
    throw new ServiceError(409, GENERATION_CONFLICT);
  await db.member.update({ where: { id }, data: { generation } });
}

export async function syncGeneration(db: DbClient, id: number): Promise<void> {
  const derived = await derivedGeneration(db, id);
  if (derived !== null) await setGeneration(db, id, derived);
  await propagateGenerations(db, id);
}

// Tạo bản ghi mới; đời: suy ra từ bố/mẹ, nếu không thì input.generation, nếu không thì fallback.
async function insertMember(
  db: DbClient,
  input: MemberInput,
  fallbackGeneration: number | null,
): Promise<number> {
  const errors = await validateParents(
    db,
    null,
    input.fatherId,
    input.motherId,
  );
  if (hasErrors(errors)) throw invalid(errors);
  const generation = input.generation ?? fallbackGeneration;
  if (input.fatherId === null && input.motherId === null && generation === null)
    throw invalid({ generation: 'Vui lòng nhập đời.' });
  const created = await db.member.create({
    data: {
      ...fieldsOf(input),
      fatherId: input.fatherId,
      motherId: input.motherId,
      // Tạm thời; syncGeneration ghi đè khi suy ra được từ bố/mẹ.
      generation: generation ?? 1,
    },
  });
  await syncGeneration(db, created.id);
  return created.id;
}

export async function createMember(
  db: Db,
  actor: Actor,
  input: MemberInput,
): Promise<{ id: number }> {
  if (!canCreateIndependentMember(actor)) throw forbidden();
  return write(db, async (tx) => ({ id: await insertMember(tx, input, null) }));
}

export async function updateMember(
  db: Db,
  actor: Actor,
  id: number,
  input: MemberInput,
): Promise<void> {
  await write(db, async (tx) => {
    const current = await requireExists(tx, id);
    await requireCanEdit(tx, actor, id);
    // R12: chỉ admin đổi bố/mẹ — đổi sang người bất kỳ sẽ biến họ thành người thân (leo quyền).
    if (
      actor.role !== 'ADMIN' &&
      (input.fatherId !== current.fatherId ||
        input.motherId !== current.motherId)
    )
      throw forbidden();
    const errors = await validateParents(
      tx,
      id,
      input.fatherId,
      input.motherId,
    );
    const genderError = await validateGenderChange(tx, id, input.gender);
    if (genderError) errors.gender = genderError;
    if (hasErrors(errors)) throw invalid(errors);
    await tx.member.update({
      where: { id },
      data: {
        ...fieldsOf(input),
        fatherId: input.fatherId,
        motherId: input.motherId,
      },
    });
    const generation = (await derivedGeneration(tx, id)) ?? input.generation;
    if (generation === null)
      throw invalid({ generation: 'Vui lòng nhập đời.' });
    await setGeneration(tx, id, generation);
    await propagateGenerations(tx, id);
  });
}

export async function deleteMember(
  db: Db,
  actor: Actor,
  id: number,
): Promise<{ avatarPath: string | null }> {
  return write(db, async (tx) => {
    const m = await requireExists(tx, id);
    if (!canDeleteMember(actor)) throw forbidden();
    const children = await tx.member.count({
      where: { OR: [{ fatherId: id }, { motherId: id }] },
    });
    if (children > 0) {
      throw new ServiceError(
        409,
        'Không thể xóa: người này còn con trong gia phả. Hãy gỡ quan hệ con trước.',
      );
    }
    const spouseIds = await spouseIdsOf(tx, id);
    // Marriage cascade, User.memberId set null (DB).
    await tx.member.delete({ where: { id } });
    for (const spouseId of spouseIds) await syncGeneration(tx, spouseId);
    return { avatarPath: m.avatarPath };
  });
}

type RelativeTarget = { existingId: number } | { member: MemberInput };

// R12 (non-admin): không gắn người có sẵn; người mới không mang bố/mẹ tùy ý.
// Riêng CHILD: vị trí của `person` bị ghi đè; vị trí còn lại chỉ được là vợ/chồng hiện tại của person.
async function checkRelativeEscalation(
  db: DbClient,
  person: { id: number; gender: 'MALE' | 'FEMALE' | null },
  relation: RelationKind,
  target: RelativeTarget,
): Promise<void> {
  if ('existingId' in target) throw forbidden();
  const { fatherId, motherId } = target.member;
  const others =
    relation !== 'CHILD'
      ? [fatherId, motherId]
      : person.gender === 'MALE'
        ? [motherId]
        : person.gender === 'FEMALE'
          ? [fatherId]
          : [fatherId, motherId];
  const given = others.filter((x) => x !== null);
  if (given.length === 0) return;
  const spouses = relation === 'CHILD' ? await spouseIdsOf(db, person.id) : [];
  if (given.some((x) => !spouses.includes(x))) throw forbidden();
}

export async function addRelative(
  db: Db,
  actor: Actor,
  id: number,
  relation: RelationKind,
  target: RelativeTarget,
): Promise<{ id: number }> {
  return write(db, async (tx) => {
    const person = await requireExists(tx, id);
    await requireCanEdit(tx, actor, id);
    if (actor.role !== 'ADMIN')
      await checkRelativeEscalation(tx, person, relation, target);

    if (relation === 'FATHER' || relation === 'MOTHER') {
      const isFather = relation === 'FATHER';
      if ((isFather ? person.fatherId : person.motherId) !== null) {
        throw new ServiceError(
          409,
          isFather ? 'Người này đã có bố.' : 'Người này đã có mẹ.',
        );
      }
      const parentId =
        'existingId' in target
          ? target.existingId
          : await insertMember(
              tx,
              { ...target.member, gender: isFather ? 'MALE' : 'FEMALE' },
              Math.max(1, person.generation - 1),
            );
      const errors = await validateParents(
        tx,
        id,
        isFather ? parentId : null,
        isFather ? null : parentId,
      );
      if (hasErrors(errors)) throw invalid(errors);
      await tx.member.update({
        where: { id },
        data: isFather ? { fatherId: parentId } : { motherId: parentId },
      });
      await syncGeneration(tx, id);
      return { id: parentId };
    }

    if (relation === 'CHILD') {
      if (person.gender === null)
        throw invalid({
          gender: 'Cần biết giới tính của người này trước khi thêm con.',
        });
      const isFather = person.gender === 'MALE';
      if ('member' in target) {
        const member = isFather
          ? { ...target.member, fatherId: id }
          : { ...target.member, motherId: id };
        return {
          id: await insertMember(tx, member, person.generation + 1),
        };
      }
      const child = await requireExists(tx, target.existingId);
      const current = isFather ? child.fatherId : child.motherId;
      if (current !== null && current !== id) {
        throw new ServiceError(
          409,
          isFather ? 'Người con này đã có bố.' : 'Người con này đã có mẹ.',
        );
      }
      const errors = await validateParents(
        tx,
        child.id,
        isFather ? id : child.fatherId,
        isFather ? child.motherId : id,
      );
      if (hasErrors(errors)) throw invalid(errors);
      await tx.member.update({
        where: { id: child.id },
        data: isFather ? { fatherId: id } : { motherId: id },
      });
      await syncGeneration(tx, child.id);
      return { id: child.id };
    }

    // SPOUSE
    const spouseId =
      'existingId' in target
        ? target.existingId
        : await insertMember(tx, target.member, person.generation);
    const error = await validateSpouse(tx, id, spouseId);
    if (error) throw invalid({ spouseId: error });
    const [person1Id, person2Id] =
      id < spouseId ? [id, spouseId] : [spouseId, id];
    await tx.marriage.create({ data: { person1Id, person2Id } });
    await syncGeneration(tx, spouseId);
    await syncGeneration(tx, id);
    return { id: spouseId };
  });
}

export async function removeSpouse(
  db: Db,
  actor: Actor,
  id: number,
  spouseId: number,
): Promise<void> {
  await write(db, async (tx) => {
    await requireExists(tx, id);
    await requireCanEdit(tx, actor, id);
    const [person1Id, person2Id] =
      id < spouseId ? [id, spouseId] : [spouseId, id];
    const marriage = await tx.marriage.findUnique({
      where: { person1Id_person2Id: { person1Id, person2Id } },
    });
    if (!marriage)
      throw new ServiceError(404, 'Không tìm thấy quan hệ vợ chồng.');
    await tx.marriage.delete({ where: { id: marriage.id } });
    await syncGeneration(tx, id);
    await syncGeneration(tx, spouseId);
  });
}

// Quyền như sửa thành viên. Kiểm 404 → 403 → định dạng trước khi ghi file xuống đĩa.
export async function setAvatar(
  db: Db,
  actor: Actor,
  id: number,
  buf: Buffer,
): Promise<{ avatarPath: string }> {
  const member = await requireExists(db, id);
  await requireCanEdit(db, actor, id);
  if (!detectImageType(buf))
    throw invalid({ file: 'Chỉ nhận ảnh JPG, PNG hoặc WebP.' });
  const avatarPath = await saveAvatarFile(buf, id);
  try {
    await db.member.update({ where: { id }, data: { avatarPath } });
  } catch (e) {
    await removeAvatarFile(avatarPath);
    throw e;
  }
  await removeAvatarFile(member.avatarPath);
  return { avatarPath };
}

export async function clearAvatar(
  db: Db,
  actor: Actor,
  id: number,
): Promise<void> {
  const member = await requireExists(db, id);
  await requireCanEdit(db, actor, id);
  await db.member.update({ where: { id }, data: { avatarPath: null } });
  await removeAvatarFile(member.avatarPath);
}

const nullsLast = (a: number | null, b: number | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a - b;

export async function getMemberDetail(
  db: Db,
  actor: Actor,
  id: number,
  today: SimpleDate,
): Promise<MemberDetail> {
  const m = await db.member.findUnique({
    where: { id },
    include: {
      father: { select: SUMMARY_SELECT },
      mother: { select: SUMMARY_SELECT },
      childrenAsFather: { select: { ...SUMMARY_SELECT, birthOrder: true } },
      childrenAsMother: { select: { ...SUMMARY_SELECT, birthOrder: true } },
      marriagesAsPerson1: { include: { person2: { select: SUMMARY_SELECT } } },
      marriagesAsPerson2: { include: { person1: { select: SUMMARY_SELECT } } },
    },
  });
  if (!m) throw new ServiceError(404, NOT_FOUND);

  const childMap = new Map(
    [...m.childrenAsFather, ...m.childrenAsMother].map((c) => [c.id, c]),
  );
  const children = [...childMap.values()]
    .sort(
      (a, b) =>
        nullsLast(a.birthOrder, b.birthOrder) ||
        nullsLast(a.birthYear, b.birthYear) ||
        nullsLast(a.birthMonth, b.birthMonth) ||
        nullsLast(a.birthDay, b.birthDay) ||
        a.id - b.id,
    )
    .map(({ birthOrder: _birthOrder, ...c }) => c);
  const spouses: SpouseSummary[] = [
    ...m.marriagesAsPerson1.map((x) => ({
      ...x.person2,
      marriageId: x.id,
      order: x.order,
      note: x.note,
    })),
    ...m.marriagesAsPerson2.map((x) => ({
      ...x.person1,
      marriageId: x.id,
      order: x.order,
      note: x.note,
    })),
  ].sort((a, b) => nullsLast(a.order, b.order) || a.marriageId - b.marriageId);

  const relatives =
    actor.memberId === null
      ? null
      : await loadDirectRelatives(db, actor.memberId);
  const anniversary =
    m.isDeceased &&
    m.anniversaryDay !== null &&
    m.anniversaryMonth !== null &&
    m.anniversaryCalendar !== null
      ? nextAnniversary(
          {
            day: m.anniversaryDay,
            month: m.anniversaryMonth,
            calendar: m.anniversaryCalendar,
          },
          today,
        )
      : null;

  return {
    id: m.id,
    fullName: m.fullName,
    generation: m.generation,
    gender: m.gender,
    isDeceased: m.isDeceased,
    birthYear: m.birthYear,
    birthMonth: m.birthMonth,
    birthDay: m.birthDay,
    deathYear: m.deathYear,
    deathMonth: m.deathMonth,
    deathDay: m.deathDay,
    deathCalendar: m.deathCalendar,
    avatarPath: m.avatarPath,
    birthOrder: m.birthOrder,
    deathLunarLeap: m.deathLunarLeap,
    anniversaryDay: m.anniversaryDay,
    anniversaryMonth: m.anniversaryMonth,
    anniversaryCalendar: m.anniversaryCalendar,
    burialPlace: m.burialPlace,
    note: m.note,
    fatherId: m.fatherId,
    motherId: m.motherId,
    father: m.father,
    mother: m.mother,
    spouses,
    children,
    generationLocked: (await derivedGeneration(db, id)) !== null,
    nextAnniversary: anniversary,
    permissions: {
      canEdit: canEditMember(actor, id, relatives),
      canDelete: canDeleteMember(actor),
    },
  };
}

export async function searchMembers(
  db: Db,
  query: {
    q?: string;
    generation?: number;
    gender?: 'MALE' | 'FEMALE';
    excludeId?: number;
    limit?: number;
  },
): Promise<SearchResult[]> {
  const q = query.q ? toSearchName(query.q) : '';
  const rows = await db.member.findMany({
    where: {
      ...(q ? { searchName: { contains: q } } : {}),
      ...(query.generation ? { generation: query.generation } : {}),
      ...(query.gender ? { gender: query.gender } : {}),
      ...(query.excludeId ? { id: { not: query.excludeId } } : {}),
    },
    select: {
      ...SUMMARY_SELECT,
      father: { select: { fullName: true } },
      mother: { select: { fullName: true } },
    },
    orderBy: [{ generation: 'asc' }, { fullName: 'asc' }, { id: 'asc' }],
    take: Math.min(Math.max(query.limit ?? 20, 1), 50),
  });
  return rows.map(({ father, mother, ...m }) => ({
    ...m,
    fatherName: father?.fullName ?? null,
    motherName: mother?.fullName ?? null,
  }));
}
