import { toSearchName } from "./name";
import type { TreeCard, TreeData, TreeFamily } from "./tree-types";

// Kích thước thẻ — family-node.tsx vẽ đúng theo các số này (xem Task 7 GĐ5).
export const CARD_W = 184;
export const CARD_PAD = 30; // viền trên 4 + viền dưới 1 + đệm 12×2, dư 1
export const AVATAR_H = 40;
export const NAME_H = 44; // tên 17px/22px, giữ chỗ 2 dòng
export const GEN_H = 22; // dòng "Đời N" (+ ĐÃ KHUẤT)
export const LINE_H = 18; // dòng phụ 13px/18px, 1 dòng
export const ITEM_GAP = 4;
export const CARD_GAP = 12;
export const FAMILY_PAD = 8;
export const SIBLING_GAP = 32;
export const TREE_GAP = 120;
export const ROW_GAP = 96; // giữa hai đời: chỗ cho nút Thu gọn (cao 40) + đường nối
export const TOP = 60;
export const LEFT = 140;
export const READABLE_ZOOM = 0.6;

export function cardLines(c: TreeCard, isSpouse: boolean): number {
  let n = isSpouse ? 1 : 0; // "vợ của …"
  if (c.birthYear !== null) n++;
  if (c.isDeceased) {
    if (c.deathYear !== null) n++;
    if (c.anniversaryDay !== null && c.anniversaryMonth !== null && c.anniversaryCalendar !== null) n++;
    if (c.burialPlace) n++;
  }
  return n;
}

export const cardHeight = (c: TreeCard, isSpouse: boolean) =>
  CARD_PAD + AVATAR_H + ITEM_GAP + NAME_H + ITEM_GAP + GEN_H + cardLines(c, isSpouse) * (ITEM_GAP + LINE_H);

export const familyCardHeight = (f: TreeFamily) =>
  Math.max(cardHeight(f.person, false), ...f.spouses.map((s) => cardHeight(s, true)));

const familyHeight = (f: TreeFamily) => familyCardHeight(f) + FAMILY_PAD * 2;

export const spouseRole = (g: "MALE" | "FEMALE" | null) => (g === "FEMALE" ? "vợ" : g === "MALE" ? "chồng" : "vợ/chồng");

export type LaidFamily = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  cardHeight: number;
  collapsed: boolean;
  hasChildren: boolean;
  hiddenCount: number;
};
export type TreeLayout = {
  families: LaidFamily[];
  edges: { from: number; to: number }[];
  bands: { generation: number; y: number; height: number }[];
  width: number;
  height: number;
};

export const familyWidth = (f: TreeFamily) =>
  (1 + f.spouses.length) * CARD_W + f.spouses.length * CARD_GAP + FAMILY_PAD * 2;

export const indexById = (data: TreeData) => new Map(data.families.map((f) => [f.id, f]));

/** Số người bị ẩn khi thu gọn f: mọi con cháu trong dòng + vợ/chồng của họ. */
export function descendantCount(byId: ReadonlyMap<number, TreeFamily>, f: TreeFamily): number {
  return f.childIds.reduce((sum, id) => {
    const c = byId.get(id);
    return c ? sum + 1 + c.spouses.length + descendantCount(byId, c) : sum;
  }, 0);
}

export function layoutTree(data: TreeData, collapsed: ReadonlySet<number>): TreeLayout {
  if (data.families.length === 0) return { families: [], edges: [], bands: [], width: 0, height: 0 };
  const byId = indexById(data);
  const minGen = Math.min(...data.families.map((f) => f.generation));
  const kids = (f: TreeFamily) =>
    collapsed.has(f.id) ? [] : f.childIds.map((id) => byId.get(id)).filter((c): c is TreeFamily => c !== undefined);

  const span = new Map<number, number>();
  const spanOf = (f: TreeFamily): number => {
    const cs = kids(f);
    const childSpan = cs.reduce((sum, c) => sum + spanOf(c), 0) + Math.max(0, cs.length - 1) * SIBLING_GAP;
    const w = Math.max(familyWidth(f), childSpan);
    span.set(f.id, w);
    return w;
  };

  // Mỗi đời cao bằng khối cao nhất của đời đó — tính trên MỌI khối (kể cả đang bị thu gọn) để thu/mở không làm dải đời nhảy.
  const maxGen = Math.max(...data.families.map((f) => f.generation));
  const rowH = new Map<number, number>();
  for (const f of data.families) rowH.set(f.generation, Math.max(rowH.get(f.generation) ?? 0, familyHeight(f)));
  const rowY = new Map<number, number>();
  for (let g = minGen, y = TOP; g <= maxGen; g++) {
    rowY.set(g, y);
    y += (rowH.get(g) ?? 0) + ROW_GAP;
  }

  const families: LaidFamily[] = [];
  const edges: { from: number; to: number }[] = [];
  const place = (f: TreeFamily, left: number) => {
    const w = span.get(f.id)!;
    const fw = familyWidth(f);
    const isCollapsed = collapsed.has(f.id);
    families.push({
      id: f.id,
      x: left + (w - fw) / 2,
      y: rowY.get(f.generation)!,
      width: fw,
      height: familyHeight(f),
      cardHeight: familyCardHeight(f),
      collapsed: isCollapsed,
      hasChildren: f.childIds.length > 0,
      hiddenCount: isCollapsed ? descendantCount(byId, f) : 0,
    });
    const cs = kids(f);
    const childSpan = cs.reduce((sum, c) => sum + span.get(c.id)!, 0) + Math.max(0, cs.length - 1) * SIBLING_GAP;
    let x = left + (w - childSpan) / 2;
    for (const c of cs) {
      edges.push({ from: f.id, to: c.id });
      place(c, x);
      x += span.get(c.id)! + SIBLING_GAP;
    }
  };

  let left = LEFT;
  for (const rootId of data.roots) {
    const root = byId.get(rootId);
    if (!root) continue;
    spanOf(root);
    place(root, left);
    left += span.get(rootId)! + TREE_GAP;
  }

  const bandGens = [...new Set(families.map((f) => byId.get(f.id)!.generation))].sort((a, b) => a - b);
  const right = Math.max(...families.map((f) => f.x + f.width));
  const bottom = Math.max(...families.map((f) => f.y + f.height));
  return {
    families,
    edges,
    bands: bandGens.map((generation) => ({
      generation,
      y: rowY.get(generation)! - ROW_GAP / 2,
      height: rowH.get(generation)! + ROW_GAP,
    })),
    width: right + LEFT,
    height: bottom + TOP,
  };
}

export function familyIdOf(data: TreeData, memberId: number): number | null {
  if (data.families.some((f) => f.id === memberId)) return memberId;
  return data.families.find((f) => f.spouses.some((s) => s.id === memberId))?.id ?? null;
}

export function ancestorFamilyIds(data: TreeData, familyId: number): number[] {
  const parent = new Map<number, number>();
  for (const f of data.families) for (const c of f.childIds) parent.set(c, f.id);
  const out: number[] = [];
  const seen = new Set<number>([familyId]);
  for (let p = parent.get(familyId); p !== undefined && !seen.has(p); p = parent.get(p)) {
    out.push(p);
    seen.add(p);
  }
  return out;
}

export type TreeHit = { memberId: number; familyId: number; fullName: string; generation: number; subtitle: string };

export function searchTree(data: TreeData, query: string): TreeHit[] {
  const q = toSearchName(query);
  if (!q || data.families.length === 0) return [];
  const minGen = Math.min(...data.families.map((f) => f.generation));
  const rootIds = new Set(data.roots);
  const hits = new Map<number, TreeHit>();
  for (const f of data.families) {
    const p = f.person;
    if (!p.searchName.includes(q)) continue;
    const subtitle = p.fatherName
      ? `con ${p.fatherName}`
      : rootIds.has(f.id) && f.generation === minGen
        ? "gốc dòng họ"
        : "chưa gắn bố (gốc riêng)";
    hits.set(p.id, { memberId: p.id, familyId: f.id, fullName: p.fullName, generation: p.generation, subtitle });
  }
  for (const f of data.families) {
    for (const s of f.spouses) {
      if (hits.has(s.id) || !s.searchName.includes(q)) continue;
      hits.set(s.id, {
        memberId: s.id,
        familyId: f.id,
        fullName: s.fullName,
        generation: s.generation,
        subtitle: `${spouseRole(s.gender)} của ${f.person.fullName}`,
      });
    }
  }
  return [...hits.values()].sort(
    (a, b) => a.generation - b.generation || a.fullName.localeCompare(b.fullName, "vi") || a.memberId - b.memberId,
  );
}

export type InitialView = { kind: "fit" } | { kind: "center"; x: number; y: number };

/**
 * Điểm mở trang cây (P7): focus từ URL → căn người đó; cây đủ nhỏ để "vừa màn hình" ở zoom ≥ 60% → vừa màn hình;
 * còn lại căn khối của mình (homeFamilyId) hoặc gốc đầu tiên, zoom 100%. Layout không rỗng.
 */
export function initialView(
  layout: TreeLayout,
  opts: { focusFamilyId: number | null; homeFamilyId: number | null; viewport: { width: number; height: number } },
): InitialView {
  const center = (id: number | null): InitialView => {
    const f = layout.families.find((x) => x.id === id) ?? layout.families[0];
    return { kind: "center", x: f.x + f.width / 2, y: f.y + f.height / 2 };
  };
  if (opts.focusFamilyId !== null) return center(opts.focusFamilyId);
  const fit = Math.min(opts.viewport.width / layout.width, opts.viewport.height / layout.height);
  if (fit >= READABLE_ZOOM) return { kind: "fit" };
  return center(opts.homeFamilyId);
}
