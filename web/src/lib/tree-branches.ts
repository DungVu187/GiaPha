import { descendantCount, indexById } from "./tree-layout";
import type { TreeData, TreeFamily } from "./tree-types";

export type BranchRow = { family: TreeFamily; depth: number; collapsed: boolean; hiddenCount: number };

/** Danh sách thụt lề theo nhánh: duyệt sâu từ các gốc theo thứ tự cây (API đã xếp con); nhánh thu gọn không liệt kê con cháu. */
export function branchRows(data: TreeData, collapsed: ReadonlySet<number>): BranchRow[] {
  const byId = indexById(data);
  const rows: BranchRow[] = [];
  const seen = new Set<number>();
  const visit = (f: TreeFamily, depth: number) => {
    if (seen.has(f.id)) return; // chặn vòng nếu dữ liệu hỏng
    seen.add(f.id);
    const isCollapsed = collapsed.has(f.id) && f.childIds.length > 0;
    rows.push({ family: f, depth, collapsed: isCollapsed, hiddenCount: isCollapsed ? descendantCount(byId, f) : 0 });
    if (isCollapsed) return;
    for (const id of f.childIds) {
      const c = byId.get(id);
      if (c) visit(c, depth + 1);
    }
  };
  for (const id of data.roots) {
    const f = byId.get(id);
    if (f) visit(f, 0);
  }
  return rows;
}
