import { toSearchName } from "./name";
import type { TreeData, TreeFamily } from "./tree-types";

export const CARD_W = 176;
export const CARD_H = 200;
export const CARD_GAP = 12;
export const FAMILY_PAD = 8;
export const SIBLING_GAP = 32;
export const TREE_GAP = 120;
export const ROW_H = 300;
export const TOP = 40;
export const LEFT = 140;

export type LaidFamily = { id: number; x: number; y: number; width: number; collapsed: boolean; hasChildren: boolean; hiddenCount: number };
export type TreeLayout = {
  families: LaidFamily[];
  edges: { from: number; to: number }[];
  bands: { generation: number; y: number }[];
  width: number;
  height: number;
};

export const familyWidth = (f: TreeFamily) =>
  (1 + f.spouses.length) * CARD_W + f.spouses.length * CARD_GAP + FAMILY_PAD * 2;

const indexById = (data: TreeData) => new Map(data.families.map((f) => [f.id, f]));

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

  const countHidden = (f: TreeFamily): number =>
    f.childIds.reduce((sum, id) => {
      const c = byId.get(id);
      return c ? sum + 1 + c.spouses.length + countHidden(c) : sum;
    }, 0);

  const families: LaidFamily[] = [];
  const edges: { from: number; to: number }[] = [];
  const place = (f: TreeFamily, left: number) => {
    const w = span.get(f.id)!;
    const fw = familyWidth(f);
    const isCollapsed = collapsed.has(f.id);
    families.push({
      id: f.id,
      x: left + (w - fw) / 2,
      y: TOP + (f.generation - minGen) * ROW_H,
      width: fw,
      collapsed: isCollapsed,
      hasChildren: f.childIds.length > 0,
      hiddenCount: isCollapsed ? countHidden(f) : 0,
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
  const bottom = Math.max(...families.map((f) => f.y));
  return {
    families,
    edges,
    bands: bandGens.map((generation) => ({ generation, y: TOP + (generation - minGen) * ROW_H })),
    width: right + LEFT,
    height: bottom + CARD_H + TOP,
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

const spouseOf = (g: "MALE" | "FEMALE" | null) => (g === "FEMALE" ? "vợ" : g === "MALE" ? "chồng" : "vợ/chồng");

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
        subtitle: `${spouseOf(s.gender)} của ${f.person.fullName}`,
      });
    }
  }
  return [...hits.values()].sort(
    (a, b) => a.generation - b.generation || a.fullName.localeCompare(b.fullName, "vi") || a.memberId - b.memberId,
  );
}
