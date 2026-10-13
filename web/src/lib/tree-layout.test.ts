import { describe, expect, it } from "vitest";
import {
  ancestorFamilyIds,
  CARD_GAP,
  CARD_W,
  FAMILY_PAD,
  familyIdOf,
  familyWidth,
  LEFT,
  layoutTree,
  ROW_H,
  searchTree,
  SIBLING_GAP,
  TOP,
  TREE_GAP,
} from "./tree-layout";
import type { TreeCard, TreeData, TreeFamily } from "./tree-types";

function card(id: number, patch: Partial<TreeCard> = {}): TreeCard {
  return {
    id, fullName: `NGƯỜI ${id}`, searchName: `nguoi ${id}`, generation: 1, gender: "MALE", isDeceased: false,
    birthYear: null, birthMonth: null, birthDay: null, deathYear: null, deathMonth: null, deathDay: null,
    deathCalendar: null, anniversaryDay: null, anniversaryMonth: null, anniversaryCalendar: null,
    burialPlace: null, avatarPath: null, fatherName: null, ...patch,
  };
}
function fam(id: number, generation: number, childIds: number[] = [], spouses: TreeCard[] = [], patch: Partial<TreeCard> = {}): TreeFamily {
  return { id, generation, person: card(id, { generation, ...patch }), spouses, childIds };
}
const W1 = CARD_W + FAMILY_PAD * 2; // khối không vợ/chồng
const W2 = 2 * CARD_W + CARD_GAP + FAMILY_PAD * 2; // khối có 1 vợ/chồng

// 1 (có vợ 9) → con 2, 3; 2 → con 4. Gốc riêng 7 ở đời 3.
const DATA: TreeData = {
  roots: [1, 7],
  families: [
    fam(1, 1, [2, 3], [card(9, { gender: "FEMALE", fullName: "BÀ CHÍN", searchName: "ba chin" })], { fullName: "ÔNG MỘT", searchName: "ong mot" }),
    fam(2, 2, [4], [], { fullName: "VŨ HAI", searchName: "vu hai", fatherName: "ÔNG MỘT" }),
    fam(3, 2, [], [], { fullName: "VŨ BA", searchName: "vu ba", fatherName: "ÔNG MỘT" }),
    fam(4, 3, [], [], { fullName: "VŨ BỐN", searchName: "vu bon", fatherName: "VŨ HAI" }),
    fam(7, 3, [], [], { fullName: "VŨ BẢY", searchName: "vu bay" }),
  ],
};
const at = (l: ReturnType<typeof layoutTree>, id: number) => l.families.find((f) => f.id === id)!;

describe("familyWidth", () => {
  it("theo số vợ/chồng", () => {
    expect(familyWidth(fam(1, 1))).toBe(W1);
    expect(familyWidth(fam(1, 1, [], [card(2)]))).toBe(W2);
  });
});

describe("layoutTree", () => {
  it("rỗng", () => {
    expect(layoutTree({ roots: [], families: [] }, new Set())).toEqual({ families: [], edges: [], bands: [], width: 0, height: 0 });
  });

  it("hàng theo đời, khối bố nằm giữa cụm con, gốc riêng đời 3 nằm hàng đời 3", () => {
    const l = layoutTree(DATA, new Set());
    expect(at(l, 1).y).toBe(TOP);
    expect(at(l, 2).y).toBe(TOP + ROW_H);
    expect(at(l, 4).y).toBe(TOP + 2 * ROW_H);
    expect(at(l, 7).y).toBe(TOP + 2 * ROW_H);
    // Con: 2 (nhánh rộng W1 vì con 4 rộng W1) và 3 (W1) → cụm con rộng 2·W1 + gap.
    const kids = 2 * W1 + SIBLING_GAP;
    // Cụm con (2·W1 + gap) rộng hơn khối bố (W2) → cụm con bắt đầu đúng tại LEFT.
    expect(kids).toBeGreaterThan(W2);
    expect(at(l, 2).x).toBe(LEFT);
    expect(at(l, 3).x).toBe(at(l, 2).x + W1 + SIBLING_GAP);
    const mid = (at(l, 2).x + at(l, 3).x + W1) / 2;
    expect(at(l, 1).x + W2 / 2).toBe(mid);
    // Cây thứ hai bắt đầu sau cây thứ nhất + TREE_GAP.
    expect(at(l, 7).x).toBe(LEFT + Math.max(W2, kids) + TREE_GAP);
    expect(l.edges).toEqual([{ from: 1, to: 2 }, { from: 2, to: 4 }, { from: 1, to: 3 }]);
    expect(l.bands).toEqual([{ generation: 1, y: TOP }, { generation: 2, y: TOP + ROW_H }, { generation: 3, y: TOP + 2 * ROW_H }]);
    expect(at(l, 1)).toMatchObject({ width: W2, collapsed: false, hasChildren: true, hiddenCount: 0 });
    expect(at(l, 3)).toMatchObject({ hasChildren: false });
  });

  it("thu gọn: ẩn mọi con cháu, đếm số người ẩn (người trong dòng + vợ/chồng)", () => {
    const l = layoutTree(DATA, new Set([1]));
    expect(l.families.map((f) => f.id).sort()).toEqual([1, 7]);
    expect(at(l, 1)).toMatchObject({ collapsed: true, hasChildren: true, hiddenCount: 3 });
    expect(l.edges).toEqual([]);
    expect(l.bands.map((b) => b.generation)).toEqual([1, 3]);
  });

  it("thu gọn khối giữa: hiddenCount chỉ tính con cháu của khối đó", () => {
    const l = layoutTree(DATA, new Set([2]));
    expect(at(l, 2)).toMatchObject({ collapsed: true, hiddenCount: 1 });
    expect(l.families.some((f) => f.id === 4)).toBe(false);
  });

  it("width/height bao toàn bộ", () => {
    const l = layoutTree(DATA, new Set());
    const right = Math.max(...l.families.map((f) => f.x + f.width));
    expect(l.width).toBe(right + LEFT);
    expect(l.height).toBe(TOP + 2 * ROW_H + 200 + TOP);
  });
});

describe("familyIdOf / ancestorFamilyIds", () => {
  it("người trong dòng → khối của chính họ; vợ → khối của chồng; không có → null", () => {
    expect(familyIdOf(DATA, 4)).toBe(4);
    expect(familyIdOf(DATA, 9)).toBe(1);
    expect(familyIdOf(DATA, 999)).toBeNull();
  });
  it("tổ tiên từ gần đến xa", () => {
    expect(ancestorFamilyIds(DATA, 4)).toEqual([2, 1]);
    expect(ancestorFamilyIds(DATA, 1)).toEqual([]);
  });
});

describe("searchTree", () => {
  it("tìm không dấu, kèm mô tả quan hệ", () => {
    expect(searchTree(DATA, "Vũ  BỐN")).toEqual([{ memberId: 4, familyId: 4, fullName: "VŨ BỐN", generation: 3, subtitle: "con VŨ HAI" }]);
    expect(searchTree(DATA, "ong mot")[0]?.subtitle).toBe("gốc dòng họ");
    expect(searchTree(DATA, "vu bay")[0]?.subtitle).toBe("chưa gắn bố (gốc riêng)");
    expect(searchTree(DATA, "chin")[0]).toEqual({ memberId: 9, familyId: 1, fullName: "BÀ CHÍN", generation: 1, subtitle: "vợ của ÔNG MỘT" });
  });
  it("xếp theo đời, rồi tên; rỗng/chỉ khoảng trắng → []", () => {
    expect(searchTree(DATA, "vu").map((h) => h.memberId)).toEqual([3, 2, 7, 4]);
    expect(searchTree(DATA, "   ")).toEqual([]);
    expect(searchTree(DATA, "khong co")).toEqual([]);
  });
  it("một người vừa trong dòng vừa là vợ/chồng ở khối khác → chỉ một kết quả, trỏ khối trong dòng", () => {
    const data: TreeData = {
      roots: [1, 5],
      families: [fam(1, 1, [], [card(6, { fullName: "CÔ SÁU", searchName: "co sau", gender: "FEMALE" })]), fam(5, 1, [6]), fam(6, 2, [], [], { fullName: "CÔ SÁU", searchName: "co sau", gender: "FEMALE", fatherName: "NGƯỜI 5" })],
    };
    expect(searchTree(data, "co sau")).toEqual([{ memberId: 6, familyId: 6, fullName: "CÔ SÁU", generation: 2, subtitle: "con NGƯỜI 5" }]);
  });
});
