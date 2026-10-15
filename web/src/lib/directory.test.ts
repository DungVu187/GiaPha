import { describe, expect, it } from "vitest";
import { directoryQuery, groupByGeneration, parseDirectoryParams } from "./directory";

describe("groupByGeneration", () => {
  it("gom các dòng liên tiếp cùng đời (API đã xếp theo đời)", () => {
    const rows = [
      { id: 1, generation: 1 },
      { id: 2, generation: 3 },
      { id: 3, generation: 3 },
      { id: 4, generation: 5 },
    ];
    expect(groupByGeneration(rows)).toEqual([
      { generation: 1, members: [rows[0]] },
      { generation: 3, members: [rows[1], rows[2]] },
      { generation: 5, members: [rows[3]] },
    ]);
  });
  it("rỗng → []", () => {
    expect(groupByGeneration([])).toEqual([]);
  });
});

describe("parseDirectoryParams", () => {
  it("đọc q (cắt khoảng trắng hai đầu) và generation", () => {
    expect(parseDirectoryParams({ q: "  vu van ", generation: "4" })).toEqual({ q: "vu van", generation: 4 });
  });
  it("thiếu / sai / dạng mảng → mặc định", () => {
    expect(parseDirectoryParams({})).toEqual({ q: "", generation: null });
    expect(parseDirectoryParams({ q: ["a", "b"], generation: ["1", "2"] })).toEqual({ q: "", generation: null });
    expect(parseDirectoryParams({ generation: "0" })).toEqual({ q: "", generation: null });
    expect(parseDirectoryParams({ generation: "abc" })).toEqual({ q: "", generation: null });
    expect(parseDirectoryParams({ generation: "1000" })).toEqual({ q: "", generation: null });
  });
  it("q dài quá 100 ký tự → cắt còn 100 (API giới hạn 100)", () => {
    expect(parseDirectoryParams({ q: "a".repeat(150) }).q).toHaveLength(100);
  });
});

describe("directoryQuery", () => {
  it("tạo chuỗi query, bỏ tham số rỗng", () => {
    expect(directoryQuery("", null)).toBe("");
    expect(directoryQuery("vu van", null)).toBe("?q=vu+van");
    expect(directoryQuery("", 3)).toBe("?generation=3");
    expect(directoryQuery("vũ", 3)).toBe("?q=v%C5%A9&generation=3");
  });
});
