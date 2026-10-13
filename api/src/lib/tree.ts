// Ai được vẽ trên cây (spec §3, D6) — thuần, không gọi DB.
export type Calendar = 'SOLAR' | 'LUNAR';
export type TreeMemberRow = {
  id: number;
  fullName: string;
  searchName: string;
  generation: number;
  gender: 'MALE' | 'FEMALE' | null;
  isDeceased: boolean;
  birthOrder: number | null;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  deathYear: number | null;
  deathMonth: number | null;
  deathDay: number | null;
  deathCalendar: Calendar | null;
  anniversaryDay: number | null;
  anniversaryMonth: number | null;
  anniversaryCalendar: Calendar | null;
  burialPlace: string | null;
  avatarPath: string | null;
  fatherId: number | null;
  motherId: number | null;
};
export type TreeMarriageRow = {
  id: number;
  person1Id: number;
  person2Id: number;
  order: number | null;
};
export type TreeCard = Omit<
  TreeMemberRow,
  'birthOrder' | 'fatherId' | 'motherId'
> & {
  fatherName: string | null;
};
export type TreeFamily = {
  id: number;
  generation: number;
  person: TreeCard;
  spouses: TreeCard[];
  childIds: number[];
};
export type TreeData = { families: TreeFamily[]; roots: number[] };

const nullsLast = (a: number | null, b: number | null): number =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a - b;

export function compareSiblings(a: TreeMemberRow, b: TreeMemberRow): number {
  return (
    nullsLast(a.birthOrder, b.birthOrder) ||
    nullsLast(a.birthYear, b.birthYear) ||
    nullsLast(a.birthMonth, b.birthMonth) ||
    nullsLast(a.birthDay, b.birthDay) ||
    a.id - b.id
  );
}

// P3: trong cặp cùng không có bố mẹ, người "đứng trước" là gốc: nam trước, rồi id nhỏ.
const comesFirst = (a: TreeMemberRow, b: TreeMemberRow): boolean => {
  const ra = a.gender === 'MALE' ? 0 : 1;
  const rb = b.gender === 'MALE' ? 0 : 1;
  return ra !== rb ? ra < rb : a.id < b.id;
};

export function buildTree(
  members: TreeMemberRow[],
  marriages: TreeMarriageRow[],
): TreeData {
  const byId = new Map(members.map((p) => [p.id, p]));
  const spouseIds = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    const list = spouseIds.get(a) ?? [];
    list.push(b);
    spouseIds.set(a, list);
  };
  for (const w of [...marriages].sort(
    (a, b) => nullsLast(a.order, b.order) || a.id - b.id,
  )) {
    if (!byId.has(w.person1Id) || !byId.has(w.person2Id)) continue;
    link(w.person1Id, w.person2Id);
    link(w.person2Id, w.person1Id);
  }

  const hasParent = (p: TreeMemberRow) =>
    p.fatherId !== null || p.motherId !== null;
  const memo = new Map<number, boolean>();
  const inProgress = new Set<number>();

  function isLineage(id: number): boolean {
    const known = memo.get(id);
    if (known !== undefined) return known;
    const p = byId.get(id);
    if (!p || inProgress.has(id)) return false; // thiếu dữ liệu hoặc vòng → không vẽ
    inProgress.add(id);
    let result: boolean;
    if (p.fatherId !== null) result = isLineage(p.fatherId);
    else if (p.motherId !== null)
      result = false; // P2
    else result = !isOutsideSpouse(p);
    inProgress.delete(id);
    memo.set(id, result);
    return result;
  }

  // Ngoài họ = không bố mẹ và cưới người trong dòng (spec §3). Vợ/chồng cũng không bố mẹ chỉ
  // tính khi đứng trước theo P3 — comesFirst kiểm trước để chỉ một chiều đệ quy.
  function isOutsideSpouse(p: TreeMemberRow): boolean {
    return (spouseIds.get(p.id) ?? []).some((sid) => {
      const s = byId.get(sid)!;
      return (hasParent(s) || comesFirst(s, p)) && isLineage(sid);
    });
  }

  const card = (p: TreeMemberRow): TreeCard => ({
    id: p.id,
    fullName: p.fullName,
    searchName: p.searchName,
    generation: p.generation,
    gender: p.gender,
    isDeceased: p.isDeceased,
    birthYear: p.birthYear,
    birthMonth: p.birthMonth,
    birthDay: p.birthDay,
    deathYear: p.deathYear,
    deathMonth: p.deathMonth,
    deathDay: p.deathDay,
    deathCalendar: p.deathCalendar,
    anniversaryDay: p.anniversaryDay,
    anniversaryMonth: p.anniversaryMonth,
    anniversaryCalendar: p.anniversaryCalendar,
    burialPlace: p.burialPlace,
    avatarPath: p.avatarPath,
    fatherName:
      p.fatherId !== null ? (byId.get(p.fatherId)?.fullName ?? null) : null,
  });

  const lineage = members.filter((p) => isLineage(p.id));
  const children = new Map<number, TreeMemberRow[]>();
  for (const p of lineage) {
    if (p.fatherId === null) continue;
    const list = children.get(p.fatherId) ?? [];
    list.push(p);
    children.set(p.fatherId, list);
  }

  const families: TreeFamily[] = lineage
    .map((p) => ({
      id: p.id,
      generation: p.generation,
      person: card(p),
      spouses: (spouseIds.get(p.id) ?? []).map((sid) => card(byId.get(sid)!)),
      childIds: (children.get(p.id) ?? [])
        .sort(compareSiblings)
        .map((c) => c.id),
    }))
    .sort((a, b) => a.generation - b.generation || a.id - b.id);

  const roots = lineage
    .filter((p) => p.fatherId === null)
    .sort((a, b) => a.generation - b.generation || compareSiblings(a, b))
    .map((p) => p.id);

  return { families, roots };
}
