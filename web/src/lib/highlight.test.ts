import { describe, expect, it } from "vitest";
import { highlightMatches } from "./highlight";

describe("highlightMatches", () => {
  it("tô phần khớp không dấu, giữ nguyên chữ gốc", () => {
    expect(highlightMatches("VŨ VĂN AN", "vu van")).toEqual([
      { text: "VŨ VĂN", hit: true },
      { text: " AN", hit: false },
    ]);
  });
  it("khớp giữa chuỗi", () => {
    expect(highlightMatches("NGUYỄN THỊ HOA", "thi")).toEqual([
      { text: "NGUYỄN ", hit: false },
      { text: "THỊ", hit: true },
      { text: " HOA", hit: false },
    ]);
  });
  it("khớp nhiều lần", () => {
    expect(highlightMatches("VŨ VĂN VŨ", "Vũ")).toEqual([
      { text: "VŨ", hit: true },
      { text: " VĂN ", hit: false },
      { text: "VŨ", hit: true },
    ]);
  });
  it("đ ↔ d", () => {
    expect(highlightMatches("ĐỖ THỊ NGÂN", "do")).toEqual([
      { text: "ĐỖ", hit: true },
      { text: " THỊ NGÂN", hit: false },
    ]);
  });
  it("ô tìm rỗng / chỉ khoảng trắng / không khớp → một đoạn không tô", () => {
    expect(highlightMatches("VŨ VĂN AN", "")).toEqual([{ text: "VŨ VĂN AN", hit: false }]);
    expect(highlightMatches("VŨ VĂN AN", "   ")).toEqual([{ text: "VŨ VĂN AN", hit: false }]);
    expect(highlightMatches("VŨ VĂN AN", "tran")).toEqual([{ text: "VŨ VĂN AN", hit: false }]);
  });
  it("chữ dạng tổ hợp (NFD) không tô sai chỗ → trả nguyên", () => {
    const nfd = "VŨ VĂN AN".normalize("NFD");
    expect(highlightMatches(nfd, "an")).toEqual([{ text: nfd, hit: false }]);
  });
});
