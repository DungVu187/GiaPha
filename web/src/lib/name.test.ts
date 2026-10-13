import { describe, expect, it } from "vitest";
import { normalizeFullName, toSearchName } from "./name";

describe("normalizeFullName", () => {
  it.each([
    ["vũ đức dũng", "VŨ ĐỨC DŨNG"],
    ["Vũ Đức Dũng", "VŨ ĐỨC DŨNG"],
    ["   vũ   đức    dũng  ", "VŨ ĐỨC DŨNG"],
    ["vũ\tđức\n dũng", "VŨ ĐỨC DŨNG"],
    ["đặng thị ánh", "ĐẶNG THỊ ÁNH"],
    ["", ""],
    ["   ", ""],
  ])("%j → %j", (input, expected) => {
    expect(normalizeFullName(input)).toBe(expected);
  });

  it("chuỗi tổ hợp NFD được đưa về NFC trước khi in hoa", () => {
    expect(normalizeFullName("vũ".normalize("NFD"))).toBe("VŨ");
  });
});

describe("toSearchName", () => {
  it("bỏ dấu, đ→d, chữ thường, gộp khoảng trắng — giống api", () => {
    expect(toSearchName("  Vũ   ĐỨC Dũng ")).toBe("vu duc dung");
    expect(toSearchName("Đặng Thị Ánh")).toBe("dang thi anh");
    expect(toSearchName("vũ".normalize("NFD"))).toBe("vu");
  });
});
