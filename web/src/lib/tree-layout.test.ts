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
  ROW_GAP,
  searchTree,
  SIBLING_GAP,
  TOP,
  TREE_GAP,
  cardHeight,
  cardLines,
  familyCardHeight,
  initialView,
  spouseRole,
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
    expect(at(l, 2).y).toBe(at(l, 1).y + at(l, 1).height + ROW_GAP);
    expect(at(l, 3).y).toBe(at(l, 2).y);
    expect(at(l, 4).y).toBe(at(l, 2).y + at(l, 2).height + ROW_GAP);
    expect(at(l, 7).y).toBe(at(l, 4).y);
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
    expect(l.bands.map((b) => [b.generation, b.y + ROW_GAP / 2])).toEqual([[1, at(l, 1).y], [2, at(l, 2).y], [3, at(l, 4).y]]);
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
    const bottom = Math.max(...l.families.map((f) => f.y + f.height));
    expect(l.height).toBe(bottom + TOP);
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

const dead = { isDeceased: true, deathYear: 1990, anniversaryDay: 1, anniversaryMonth: 2, anniversaryCalendar: "LUNAR" as const, burialPlace: "Quê nhà" };

describe("cardLines / cardHeight", () => {
  it("người còn sống chưa có năm sinh: không dòng phụ, cao 144", () => {
    expect(cardLines(card(1), false)).toBe(0);
    expect(cardHeight(card(1), false)).toBe(144);
  });
  it("có năm sinh: 1 dòng → 166", () => {
    expect(cardHeight(card(1, { birthYear: 1950 }), false)).toBe(166);
  });
  it("đã khuất đủ Sinh/Mất/Giỗ/An táng: 4 dòng → 232", () => {
    expect(cardLines(card(1, { ...dead, birthYear: 1920 }), false)).toBe(4);
    expect(cardHeight(card(1, { ...dead, birthYear: 1920 }), false)).toBe(232);
  });
  it("người còn sống không tính Mất/Giỗ/An táng dù có dữ liệu", () => {
    expect(cardLines(card(1, { ...dead, isDeceased: false }), false)).toBe(0);
  });
  it("giỗ thiếu lịch không tính dòng Giỗ", () => {
    expect(cardLines(card(1, { ...dead, anniversaryCalendar: null }), false)).toBe(2);
  });
  it("thẻ vợ/chồng thêm dòng 'vợ của …'", () => {
    expect(cardLines(card(2, { gender: "FEMALE" }), true)).toBe(1);
  });
  it("khối gia đình cao theo thẻ cao nhất", () => {
    const fam = { id: 1, generation: 1, person: card(1), spouses: [card(2, { ...dead, gender: "FEMALE" })], childIds: [] };
    expect(familyCardHeight(fam)).toBe(144 + 4 * 22); // vợ: vợ của + Mất + Giỗ + An táng
  });
});

describe("layoutTree — chiều cao theo nội dung", () => {
  const data: TreeData = {
    roots: [1],
    families: [
      { id: 1, generation: 1, person: card(1, { ...dead, birthYear: 1900 }), spouses: [], childIds: [2] },
      { id: 2, generation: 2, person: card(2, { generation: 2 }), spouses: [], childIds: [] },
    ],
  };
  it("đời sau đặt dưới khối cao nhất đời trước + ROW_GAP", () => {
    const l = layoutTree(data, new Set());
    const f1 = l.families.find((f) => f.id === 1)!;
    const f2 = l.families.find((f) => f.id === 2)!;
    expect(f1.y).toBe(TOP);
    expect(f1.cardHeight).toBe(232);
    expect(f1.height).toBe(232 + FAMILY_PAD * 2);
    expect(f2.y).toBe(TOP + f1.height + ROW_GAP);
    expect(f2.cardHeight).toBe(144);
  });
  it("dải đời phủ cả nửa khoảng cách; thu gọn không làm dải đời nhảy", () => {
    const open = layoutTree(data, new Set());
    expect(open.bands[0]).toEqual({ generation: 1, y: TOP - ROW_GAP / 2, height: open.families[0].height + ROW_GAP });
    const closed = layoutTree(data, new Set([1]));
    expect(closed.bands).toHaveLength(1);
    expect(closed.families[0].y).toBe(open.families[0].y);
  });
  it("thu gọn gốc A có con đời 2 thẻ cao → band đời 2 và khối đời 3 của B không đổi", () => {
    // A (1) → 2 (đã khuất, thẻ cao); B (5) → 6 (thẻ thấp) → 7 (đời 3).
    const two: TreeData = {
      roots: [1, 5],
      families: [
        fam(1, 1, [2]),
        fam(2, 2, [], [], { ...dead, birthYear: 1920 }),
        fam(5, 1, [6]),
        fam(6, 2, [7]),
        fam(7, 3),
      ],
    };
    const open = layoutTree(two, new Set());
    const closed = layoutTree(two, new Set([1]));
    expect(at(open, 2).cardHeight).toBeGreaterThan(at(open, 6).cardHeight);
    expect(closed.families.some((f) => f.id === 2)).toBe(false);
    expect(at(closed, 7).y).toBe(at(open, 7).y);
    const band2 = (l: ReturnType<typeof layoutTree>) => l.bands.find((b) => b.generation === 2);
    expect(band2(closed)).toEqual(band2(open));
  });
});

describe("spouseRole", () => {
  it("vợ / chồng / chưa rõ", () => {
    expect(spouseRole("FEMALE")).toBe("vợ");
    expect(spouseRole("MALE")).toBe("chồng");
    expect(spouseRole(null)).toBe("vợ/chồng");
  });
});

describe("initialView", () => {
  const laid = (id: number, x: number, y: number) => ({ id, x, y, width: 200, height: 160, cardHeight: 144, collapsed: false, hasChildren: false, hiddenCount: 0 });
  const big = { families: [laid(1, 140, 40), laid(5, 3000, 2000)], edges: [], bands: [], width: 5000, height: 3000 };
  const viewport = { width: 1280, height: 650 };
  it("có focus từ URL → căn khối đó, kể cả khi cây nhỏ", () => {
    const small = { ...big, width: 600, height: 400 };
    expect(initialView(small, { focusFamilyId: 5, homeFamilyId: null, viewport })).toEqual({ kind: "center", x: 3100, y: 2080 });
  });
  it("cây nhỏ (zoom vừa màn ≥ 60%) → vừa màn hình", () => {
    const small = { ...big, width: 2000, height: 1000 }; // min(0.64, 0.65) = 0.64
    expect(initialView(small, { focusFamilyId: null, homeFamilyId: 5, viewport })).toEqual({ kind: "fit" });
  });
  it("đúng ngưỡng 60% vẫn vừa màn hình", () => {
    const edge = { ...big, width: 2000, height: 100 }; // 1200 / 2000 = 0.6
    expect(initialView(edge, { focusFamilyId: null, homeFamilyId: null, viewport: { width: 1200, height: 650 } })).toEqual({ kind: "fit" });
  });
  it("cây lớn → căn khối của mình", () => {
    expect(initialView(big, { focusFamilyId: null, homeFamilyId: 5, viewport })).toEqual({ kind: "center", x: 3100, y: 2080 });
  });
  it("cây lớn, chưa liên kết hoặc mình không có trên cây → căn gốc đầu tiên", () => {
    expect(initialView(big, { focusFamilyId: null, homeFamilyId: null, viewport })).toEqual({ kind: "center", x: 240, y: 120 });
    expect(initialView(big, { focusFamilyId: null, homeFamilyId: 99, viewport })).toEqual({ kind: "center", x: 240, y: 120 });
  });
});
