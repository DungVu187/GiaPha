import { describe, expect, it } from "vitest";
import {
  emptyMemberForm,
  memberFormFromDetail,
  parentGenerationPreview,
  parseNumberField,
  pickerKeyAction,
  toMemberBody,
} from "./member-form";
import type { MemberDetail } from "./member-types";

describe("parseNumberField", () => {
  it.each([
    ["", null],
    ["   ", null],
    ["0", 0],
    ["12", 12],
    [" 7 ", 7],
    ["007", 7],
    ["3a", "3a"],
    ["-1", "-1"],
    ["1.5", "1.5"],
  ])("%j → %j", (input, expected) => {
    expect(parseNumberField(input)).toBe(expected);
  });
});

describe("toMemberBody", () => {
  it("form trống tối thiểu", () => {
    const body = toMemberBody({ ...emptyMemberForm(), fullName: " vũ văn an ", generation: "1" });
    expect(body).toEqual({
      fullName: " vũ văn an ",
      gender: null,
      generation: 1,
      birthOrder: null,
      birthYear: null,
      birthMonth: null,
      birthDay: null,
      isDeceased: false,
      note: "",
      fatherId: null,
      motherId: null,
    });
  });
  it("số không hợp lệ gửi nguyên chuỗi để server báo lỗi", () => {
    expect(toMemberBody({ ...emptyMemberForm(), fullName: "a", generation: "3a" }).generation).toBe("3a");
  });
  it("ngày sinh và giới tính", () => {
    expect(
      toMemberBody({ ...emptyMemberForm(), gender: "FEMALE", birthDay: "18", birthMonth: "7", birthYear: "1920" }),
    ).toMatchObject({ gender: "FEMALE", birthDay: 18, birthMonth: 7, birthYear: 1920 });
  });
  it("còn sống: không gửi trường đã khuất dù form còn giá trị cũ", () => {
    const body = toMemberBody({
      ...emptyMemberForm(),
      fullName: "a",
      deathYear: "1998",
      burialPlace: "x",
      anniversaryDay: "1",
      deathLunarLeap: true,
    });
    for (const k of [
      "deathYear",
      "deathMonth",
      "deathDay",
      "deathCalendar",
      "deathLunarLeap",
      "anniversaryDay",
      "anniversaryMonth",
      "anniversaryCalendar",
      "burialPlace",
    ])
      expect(body).not.toHaveProperty(k);
  });
  it("đã khuất: lịch ngày mất chỉ gửi khi có ngày mất; nhuận chỉ với âm lịch", () => {
    const dead = { ...emptyMemberForm(), fullName: "a", isDeceased: true };
    expect(toMemberBody(dead)).toMatchObject({
      isDeceased: true,
      deathYear: null,
      deathCalendar: null,
      deathLunarLeap: false,
      anniversaryDay: null,
      anniversaryMonth: null,
      anniversaryCalendar: null,
      burialPlace: "",
    });
    expect(toMemberBody({ ...dead, deathYear: "1998", deathCalendar: "SOLAR", deathLunarLeap: true })).toMatchObject({
      deathYear: 1998,
      deathCalendar: "SOLAR",
      deathLunarLeap: false,
    });
    expect(
      toMemberBody({ ...dead, deathYear: "2023", deathMonth: "2", deathCalendar: "LUNAR", deathLunarLeap: true }),
    ).toMatchObject({ deathCalendar: "LUNAR", deathLunarLeap: true });
    expect(toMemberBody({ ...dead, anniversaryDay: "12", anniversaryMonth: "3" })).toMatchObject({
      anniversaryDay: 12,
      anniversaryMonth: 3,
      anniversaryCalendar: "LUNAR",
    });
    expect(toMemberBody({ ...dead, anniversaryMonth: "3", anniversaryCalendar: "SOLAR" })).toMatchObject({
      anniversaryDay: null,
      anniversaryCalendar: "SOLAR",
    });
    expect(toMemberBody({ ...dead, burialPlace: " Đồng Lạc " }).burialPlace).toBe(" Đồng Lạc ");
  });
  it("bố mẹ → id", () => {
    const s = { ...emptyMemberForm(), fullName: "a", father: { id: 7, fullName: "B", generation: 2 }, mother: null };
    expect(toMemberBody(s)).toMatchObject({ fatherId: 7, motherId: null });
  });
});

describe("parentGenerationPreview", () => {
  it("ưu tiên bố, rồi mẹ, rồi null", () => {
    const s = emptyMemberForm();
    expect(parentGenerationPreview(s)).toBeNull();
    expect(parentGenerationPreview({ ...s, mother: { id: 2, fullName: "M", generation: 4 } })).toBe(5);
    expect(
      parentGenerationPreview({
        ...s,
        father: { id: 1, fullName: "F", generation: 2 },
        mother: { id: 2, fullName: "M", generation: 4 },
      }),
    ).toBe(3);
  });
});

describe("emptyMemberForm", () => {
  it("lịch mặc định: ngày mất dương, giỗ âm", () => {
    expect(emptyMemberForm()).toMatchObject({
      fullName: "",
      gender: null,
      isDeceased: false,
      deathCalendar: "SOLAR",
      deathLunarLeap: false,
      anniversaryCalendar: "LUNAR",
      father: null,
      mother: null,
    });
  });
});

describe("memberFormFromDetail", () => {
  const base = {
    id: 5,
    fullName: "VŨ VĂN AN",
    generation: 3,
    gender: "MALE",
    isDeceased: true,
    birthYear: 1920,
    birthMonth: null,
    birthDay: null,
    deathYear: 1998,
    deathMonth: 4,
    deathDay: 8,
    deathCalendar: "SOLAR",
    deathLunarLeap: false,
    anniversaryDay: 12,
    anniversaryMonth: 3,
    anniversaryCalendar: "LUNAR",
    burialPlace: null,
    note: "Trưởng chi",
    birthOrder: 1,
    avatarPath: null,
    fatherId: 1,
    motherId: null,
    father: { id: 1, fullName: "VŨ ĐÌNH KHẢI", generation: 2, isDeceased: true },
    mother: null,
  };
  it("chuyển số thành chuỗi, null thành rỗng, giữ bố/mẹ", () => {
    const d = base as unknown as MemberDetail;
    expect(memberFormFromDetail(d)).toMatchObject({
      fullName: "VŨ VĂN AN",
      generation: "3",
      birthYear: "1920",
      birthMonth: "",
      deathDay: "8",
      deathCalendar: "SOLAR",
      anniversaryDay: "12",
      anniversaryCalendar: "LUNAR",
      burialPlace: "",
      note: "Trưởng chi",
      birthOrder: "1",
      mother: null,
    });
    expect(memberFormFromDetail(d).father).toEqual({ id: 1, fullName: "VŨ ĐÌNH KHẢI", generation: 2 });
  });
  it("lịch null → mặc định; sửa không đổi gì thì gửi lại đúng bố/mẹ đang lưu", () => {
    const d = { ...base, deathCalendar: null, anniversaryCalendar: null, note: null } as unknown as MemberDetail;
    const s = memberFormFromDetail(d);
    expect(s).toMatchObject({ deathCalendar: "SOLAR", anniversaryCalendar: "LUNAR", note: "" });
    expect(toMemberBody(s)).toMatchObject({ fatherId: 1, motherId: null });
  });
});

describe("pickerKeyAction", () => {
  const s = (count: number, active: number, listOpen: boolean) => ({ count, active, listOpen });

  it("Enter với mục đang chọn trong danh sách mở → chọn mục đó", () => {
    expect(pickerKeyAction("Enter", s(3, 1, true))).toEqual({ preventDefault: true, choose: 1 });
  });

  it.each([
    ["danh sách đóng", s(3, 1, false)],
    ["chưa chọn mục nào", s(3, -1, true)],
    ["không có kết quả", s(0, -1, true)],
    ["chưa tìm gì", s(0, -1, false)],
  ])("Enter khi %s → không submit form, không chọn gì", (_, state) => {
    expect(pickerKeyAction("Enter", state)).toEqual({ preventDefault: true });
  });

  it("ArrowDown/ArrowUp xoay vòng và mở danh sách", () => {
    expect(pickerKeyAction("ArrowDown", s(3, -1, false))).toEqual({ preventDefault: true, open: true, active: 0 });
    expect(pickerKeyAction("ArrowDown", s(3, 2, true))).toEqual({ preventDefault: true, open: true, active: 0 });
    expect(pickerKeyAction("ArrowUp", s(3, 0, true))).toEqual({ preventDefault: true, open: true, active: 2 });
    expect(pickerKeyAction("ArrowUp", s(3, -1, true))).toEqual({ preventDefault: true, open: true, active: 2 });
  });

  it("mũi tên khi không có kết quả → bỏ qua", () => {
    expect(pickerKeyAction("ArrowDown", s(0, -1, false))).toEqual({ preventDefault: false });
  });

  it("Escape đóng danh sách đang mở; khi đóng thì bỏ qua", () => {
    expect(pickerKeyAction("Escape", s(3, 0, true))).toEqual({ preventDefault: true, open: false });
    expect(pickerKeyAction("Escape", s(3, 0, false))).toEqual({ preventDefault: false });
  });

  it("phím khác → bỏ qua", () => {
    expect(pickerKeyAction("a", s(3, 0, true))).toEqual({ preventDefault: false });
  });
});
