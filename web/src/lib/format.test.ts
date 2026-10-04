import { describe, expect, it } from "vitest";
import {
  formatAnniversaryLong, formatAnniversaryShort, formatDaysLeft, formatDeathDate,
  formatPartialDate, genderLabel, initialOf, spouseLabel,
} from "./format";

describe("format", () => {
  it("ngày không đầy đủ", () => {
    expect(formatPartialDate({ year: null, month: null, day: null })).toBe("");
    expect(formatPartialDate({ year: 1920, month: null, day: null })).toBe("1920");
    expect(formatPartialDate({ year: 1920, month: 7, day: null })).toBe("07/1920");
    expect(formatPartialDate({ year: 1920, month: 7, day: 18 })).toBe("18/07/1920");
  });
  it("ngày giỗ (đệm 0)", () => {
    expect(formatAnniversaryShort(12, 3, "LUNAR")).toBe("12/03 ÂL");
    expect(formatAnniversaryShort(25, 9, "SOLAR")).toBe("25/09");
    expect(formatAnniversaryLong(12, 3, "LUNAR")).toBe("12/03 Âm lịch");
    expect(formatAnniversaryLong(25, 9, "SOLAR")).toBe("25/09 Dương lịch");
  });
  it("ngày mất", () => {
    const base = { deathYear: 1998, deathMonth: 4, deathDay: 8, deathCalendar: "SOLAR" as const, deathLunarLeap: false };
    expect(formatDeathDate(base)).toBe("08/04/1998 (dương lịch)");
    expect(formatDeathDate({ ...base, deathMonth: 3, deathDay: 12, deathCalendar: "LUNAR" })).toBe("12/03/1998 (âm lịch)");
    expect(formatDeathDate({ ...base, deathMonth: 2, deathDay: 10, deathCalendar: "LUNAR", deathLunarLeap: true })).toBe("10/02/1998 (âm lịch, tháng nhuận)");
    expect(formatDeathDate({ ...base, deathMonth: null, deathDay: null })).toBe("1998 (dương lịch)");
    expect(formatDeathDate({ ...base, deathDay: null })).toBe("04/1998 (dương lịch)");
    expect(formatDeathDate({ ...base, deathYear: null, deathMonth: null, deathDay: null, deathCalendar: null })).toBe("");
  });
  it("còn N ngày", () => {
    expect(formatDaysLeft(0)).toBe("hôm nay");
    expect(formatDaysLeft(1)).toBe("còn 1 ngày");
    expect(formatDaysLeft(197)).toBe("còn 197 ngày");
  });
  it("nhãn", () => {
    expect(genderLabel("MALE")).toBe("Nam");
    expect(genderLabel("FEMALE")).toBe("Nữ");
    expect(genderLabel(null)).toBe("Chưa rõ");
    expect(spouseLabel("MALE")).toBe("Vợ");
    expect(spouseLabel("FEMALE")).toBe("Chồng");
    expect(spouseLabel(null)).toBe("Vợ/Chồng");
    expect(initialOf("VŨ VĂN AN")).toBe("A");
    expect(initialOf("ĐẶNG THỊ ÁNH")).toBe("Á");
    expect(initialOf("")).toBe("?");
  });
});
