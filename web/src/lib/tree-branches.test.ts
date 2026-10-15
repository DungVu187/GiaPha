import { describe, expect, it } from "vitest";
import { branchRows } from "./tree-branches";
import type { TreeCard, TreeData, TreeFamily } from "./tree-types";

const card = (id: number): TreeCard => ({
  id,
  fullName: `VŨ VĂN ${id}`,
  searchName: `vu van ${id}`,
  generation: 1,
  gender: "MALE",
  isDeceased: false,
  birthYear: null,
  birthMonth: null,
  birthDay: null,
  deathYear: null,
  deathMonth: null,
  deathDay: null,
  deathCalendar: null,
  anniversaryDay: null,
  anniversaryMonth: null,
  anniversaryCalendar: null,
  burialPlace: null,
  avatarPath: null,
  fatherName: null,
});
const fam = (id: number, childIds: number[], spouses: number[] = []): TreeFamily => ({
  id,
  generation: 1,
  person: card(id),
  spouses: spouses.map(card),
  childIds,
});

// 1 ─┬─ 2 ── 4 (vợ 40)
//    └─ 3
// 9 (gốc riêng)
const data: TreeData = {
  roots: [1, 9],
  families: [fam(1, [2, 3], [10]), fam(2, [4]), fam(3, []), fam(4, [], [40]), fam(9, [])],
};
const view = (rows: ReturnType<typeof branchRows>) => rows.map((r) => [r.family.id, r.depth, r.collapsed, r.hiddenCount]);

describe("branchRows", () => {
  it("duyệt sâu theo thứ tự cây, thụt theo độ sâu", () => {
    expect(view(branchRows(data, new Set()))).toEqual([
      [1, 0, false, 0],
      [2, 1, false, 0],
      [4, 2, false, 0],
      [3, 1, false, 0],
      [9, 0, false, 0],
    ]);
  });
  it("thu gọn nhánh → ẩn con cháu, đếm cả vợ/chồng của con cháu", () => {
    expect(view(branchRows(data, new Set([2])))).toEqual([
      [1, 0, false, 0],
      [2, 1, true, 2],
      [3, 1, false, 0],
      [9, 0, false, 0],
    ]);
  });
  it("thu gọn người không có con → không tính là thu gọn", () => {
    expect(view(branchRows(data, new Set([3]))).find((r) => r[0] === 3)).toEqual([3, 1, false, 0]);
  });
  it("cây trống → []", () => {
    expect(branchRows({ roots: [], families: [] }, new Set())).toEqual([]);
  });
  it("dữ liệu hỏng có vòng childIds → không lặp vô hạn", () => {
    const loop: TreeData = { roots: [1], families: [fam(1, [2]), fam(2, [1])] };
    expect(view(branchRows(loop, new Set()))).toEqual([
      [1, 0, false, 0],
      [2, 1, false, 0],
    ]);
  });
});
