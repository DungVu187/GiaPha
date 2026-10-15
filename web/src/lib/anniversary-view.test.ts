import { describe, expect, it } from "vitest";
import type { UpcomingAnniversary } from "./anniversary-types";
import { daysLeftLabel, formatSolarLong, formatToday, groupByMonth, urgencyOf, weekdayOf, within } from "./anniversary-view";

const item = (id: number, date: { year: number; month: number; day: number }, daysLeft: number): UpcomingAnniversary => ({
  id,
  fullName: `VŨ VĂN ${id}`,
  generation: 1,
  avatarPath: null,
  day: 1,
  month: 1,
  calendar: "LUNAR",
  date,
  daysLeft,
});

describe("weekdayOf / formatSolarLong", () => {
  it("thứ trong tuần", () => {
    expect(weekdayOf({ year: 2026, month: 10, day: 3 })).toBe("Thứ Bảy");
    expect(weekdayOf({ year: 2026, month: 10, day: 4 })).toBe("Chủ nhật");
    expect(weekdayOf({ year: 2026, month: 10, day: 5 })).toBe("Thứ Hai");
    expect(weekdayOf({ year: 2024, month: 2, day: 29 })).toBe("Thứ Năm");
  });
  it("định dạng dài, đệm 0", () => {
    expect(formatSolarLong({ year: 2026, month: 10, day: 5 })).toBe("Thứ Hai, 05/10/2026");
  });
});

describe("formatToday", () => {
  const solar = { year: 2026, month: 10, day: 3 };
  it("kèm ngày âm và năm can chi", () => {
    expect(formatToday({ solar, lunar: { year: 2026, month: 8, day: 23, leap: false }, lunarYearName: "Bính Ngọ" })).toBe(
      "Thứ Bảy, 03/10/2026 — ngày 23/08 năm Bính Ngọ (âm lịch)",
    );
  });
  it("tháng nhuận", () => {
    expect(formatToday({ solar, lunar: { year: 2025, month: 6, day: 2, leap: true }, lunarYearName: "Ất Tỵ" })).toBe(
      "Thứ Bảy, 03/10/2026 — ngày 02/06 nhuận năm Ất Tỵ (âm lịch)",
    );
  });
  it("không có âm lịch → chỉ dương lịch", () => {
    expect(formatToday({ solar, lunar: null, lunarYearName: null })).toBe("Thứ Bảy, 03/10/2026");
  });
});

describe("groupByMonth / within", () => {
  const items = [
    item(1, { year: 2026, month: 10, day: 3 }, 0),
    item(2, { year: 2026, month: 10, day: 29 }, 26),
    item(3, { year: 2026, month: 11, day: 11 }, 39),
    item(4, { year: 2027, month: 1, day: 2 }, 91),
  ];
  it("nhóm theo tháng dương, giữ thứ tự", () => {
    expect(groupByMonth(items).map((g) => [g.year, g.month, g.items.map((i) => i.id)])).toEqual([
      [2026, 10, [1, 2]],
      [2026, 11, [3]],
      [2027, 1, [4]],
    ]);
    expect(groupByMonth([])).toEqual([]);
  });
  it("within: còn ≤ N ngày", () => {
    expect(within(items, 30).map((i) => i.id)).toEqual([1, 2]);
    expect(within(items, 0).map((i) => i.id)).toEqual([1]);
  });
});

describe("urgencyOf / daysLeftLabel", () => {
  it("hôm nay / ≤ 7 ngày / xa hơn", () => {
    expect(urgencyOf(0)).toBe("today");
    expect(urgencyOf(1)).toBe("soon");
    expect(urgencyOf(7)).toBe("soon");
    expect(urgencyOf(8)).toBe("later");
  });
  it("nhãn", () => {
    expect(daysLeftLabel(0)).toBe("Hôm nay");
    expect(daysLeftLabel(5)).toBe("Còn 5 ngày");
  });
});
