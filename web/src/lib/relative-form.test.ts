import { describe, expect, it } from "vitest";
import { relationTitle, relativeBody, relativeGender } from "./relative-form";

describe("relativeGender", () => {
  it("bố nam, mẹ nữ, vợ/chồng ngược giới, con tùy chọn", () => {
    expect(relativeGender("FATHER", "FEMALE")).toBe("MALE");
    expect(relativeGender("MOTHER", null)).toBe("FEMALE");
    expect(relativeGender("SPOUSE", "MALE")).toBe("FEMALE");
    expect(relativeGender("SPOUSE", "FEMALE")).toBe("MALE");
    expect(relativeGender("SPOUSE", null)).toBeNull();
    expect(relativeGender("CHILD", "MALE")).toBeNull();
  });
});

describe("relationTitle", () => {
  it.each([
    ["FATHER", "MALE", "Thêm bố"],
    ["MOTHER", "MALE", "Thêm mẹ"],
    ["SPOUSE", "MALE", "Thêm vợ"],
    ["SPOUSE", "FEMALE", "Thêm chồng"],
    ["SPOUSE", null, "Thêm vợ/chồng"],
    ["CHILD", "FEMALE", "Thêm con"],
  ] as const)("%s/%s → %s", (r, g, t) => {
    expect(relationTitle(r, g)).toBe(t);
  });
});

describe("relativeBody", () => {
  it("người có sẵn", () => {
    expect(relativeBody("CHILD", { existing: { id: 9, fullName: "A", generation: 3 } })).toEqual({
      relation: "CHILD",
      existingId: 9,
    });
  });
  it("người mới: năm sinh rỗng → null, số → number", () => {
    expect(
      relativeBody("SPOUSE", { created: { fullName: "lê thị dâu", gender: "FEMALE", birthYear: "", isDeceased: false } }),
    ).toEqual({
      relation: "SPOUSE",
      member: { fullName: "lê thị dâu", gender: "FEMALE", birthYear: null, isDeceased: false },
    });
    expect(
      relativeBody("CHILD", { created: { fullName: "a", gender: null, birthYear: "1990", isDeceased: true } }),
    ).toMatchObject({
      member: { birthYear: 1990, isDeceased: true },
    });
  });
  it("người mới: năm sinh sai → gửi nguyên chuỗi để server báo lỗi", () => {
    const body = relativeBody("SPOUSE", { created: { fullName: "a", gender: "MALE", birthYear: "19x0", isDeceased: false } });
    expect(body).toMatchObject({ member: { birthYear: "19x0" } });
  });
  it("thêm con có bố/mẹ còn lại: người xem nam → motherId, nữ → fatherId", () => {
    const created = { fullName: "a", gender: null, birthYear: "", isDeceased: false, otherParentId: 7 };
    expect(relativeBody("CHILD", { created }, "MALE")).toMatchObject({ member: { motherId: 7 } });
    expect(relativeBody("CHILD", { created }, "FEMALE")).toMatchObject({ member: { fatherId: 7 } });
  });
  it("bố/mẹ còn lại bị bỏ qua khi không phải thêm con, hoặc chưa rõ giới tính người xem", () => {
    const created = { fullName: "a", gender: null, birthYear: "", isDeceased: false, otherParentId: 7 };
    const keys = (b: Record<string, unknown>) => Object.keys(b.member as object);
    expect(keys(relativeBody("CHILD", { created }, null))).not.toContain("fatherId");
    expect(keys(relativeBody("CHILD", { created }, null))).not.toContain("motherId");
    expect(keys(relativeBody("SPOUSE", { created }, "MALE"))).not.toContain("motherId");
  });
});
