import { describe, expect, it } from "vitest";
import { introLine } from "./dashboard";

const stats = { memberCount: 286, generations: [1, 2, 3, 4, 5, 6, 7, 8, 9] };
const total = "Gia phả hiện có 286 thành viên qua 9 đời.";

describe("introLine", () => {
  it("có bố và mẹ", () => {
    expect(introLine({ father: "VŨ ĐỨC THỊNH", mother: "TRẦN THỊ LAN" }, stats)).toBe(
      `Con ông VŨ ĐỨC THỊNH và bà TRẦN THỊ LAN. ${total}`,
    );
  });
  it("chỉ bố / chỉ mẹ", () => {
    expect(introLine({ father: "VŨ ĐỨC THỊNH", mother: null }, stats)).toBe(`Con ông VŨ ĐỨC THỊNH. ${total}`);
    expect(introLine({ father: null, mother: "TRẦN THỊ LAN" }, stats)).toBe(`Con bà TRẦN THỊ LAN. ${total}`);
  });
  it("không có bố mẹ / chưa liên kết → chỉ số liệu", () => {
    expect(introLine({ father: null, mother: null }, stats)).toBe(total);
    expect(introLine(null, stats)).toBe(total);
  });
  it("gia phả trống", () => {
    expect(introLine(null, { memberCount: 0, generations: [] })).toBe("Gia phả hiện có 0 thành viên qua 0 đời.");
  });
});
