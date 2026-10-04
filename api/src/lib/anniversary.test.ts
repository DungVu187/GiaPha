import { describe, expect, it } from 'vitest';
import {
  nextAnniversary,
  suggestAnniversary,
  todayInVietnam,
} from './anniversary.js';
import { jdFromDate, lunarToSolar } from './lunar.js';

const s = (day: number, month: number, year: number) => ({ day, month, year });
const pd = (
  year: number | null,
  month: number | null = null,
  day: number | null = null,
) => ({ year, month, day });
const TODAY = s(3, 10, 2026); // = 23/8/2026 âm lịch
const days = (
  from: { day: number; month: number; year: number },
  to: { day: number; month: number; year: number },
) =>
  jdFromDate(to.day, to.month, to.year) -
  jdFromDate(from.day, from.month, from.year);

describe('todayInVietnam', () => {
  it('đổi ngày lúc 17:00 UTC', () => {
    expect(todayInVietnam(new Date('2026-10-03T16:59:59Z'))).toEqual(
      s(3, 10, 2026),
    );
    expect(todayInVietnam(new Date('2026-10-03T17:00:00Z'))).toEqual(
      s(4, 10, 2026),
    );
  });
});

describe('suggestAnniversary', () => {
  it('ngày mất dương lịch đủ ngày → ngày/tháng âm', () => {
    expect(suggestAnniversary(pd(2026, 9, 25), 'SOLAR')).toEqual({
      day: 15,
      month: 8,
      calendar: 'LUNAR',
    });
  });
  it('mất trong tháng nhuận → tháng thường cùng số', () => {
    // 22/03/2023 = 1/2 nhuận năm Quý Mão
    expect(suggestAnniversary(pd(2023, 3, 22), 'SOLAR')).toEqual({
      day: 1,
      month: 2,
      calendar: 'LUNAR',
    });
  });
  it('ngày mất âm lịch có ngày + tháng → lấy luôn', () => {
    expect(suggestAnniversary(pd(1985, 11, 5), 'LUNAR')).toEqual({
      day: 5,
      month: 11,
      calendar: 'LUNAR',
    });
  });
  it.each([
    [pd(1998, 4), 'SOLAR'],
    [pd(1998), 'SOLAR'],
    [pd(null), 'SOLAR'],
    [pd(1700, 4, 8), 'SOLAR'],
    [pd(1985, 11), 'LUNAR'],
    [pd(1985, 11, 5), null],
  ] as const)('không đủ dữ liệu %j %s → null', (d, cal) => {
    expect(suggestAnniversary(d, cal)).toBeNull();
  });
});

describe('nextAnniversary — âm lịch', () => {
  it('đúng hôm nay → daysLeft 0', () => {
    expect(
      nextAnniversary({ day: 23, month: 8, calendar: 'LUNAR' }, TODAY),
    ).toEqual({ date: TODAY, daysLeft: 0 });
  });
  it('đã qua trong năm âm → sang năm âm sau', () => {
    const expected = lunarToSolar({
      day: 15,
      month: 8,
      year: 2027,
      leap: false,
    })!;
    expect(
      nextAnniversary({ day: 15, month: 8, calendar: 'LUNAR' }, TODAY),
    ).toEqual({ date: expected, daysLeft: days(TODAY, expected) });
  });
  it('chưa tới trong năm âm → năm âm hiện tại', () => {
    const expected = lunarToSolar({
      day: 15,
      month: 9,
      year: 2026,
      leap: false,
    })!;
    expect(
      nextAnniversary({ day: 15, month: 9, calendar: 'LUNAR' }, TODAY),
    ).toEqual({ date: expected, daysLeft: days(TODAY, expected) });
  });
  it('tháng không có ngày 30 → ngày 29', () => {
    for (const month of [9, 10, 11, 12]) {
      const expected =
        lunarToSolar({ day: 30, month, year: 2026, leap: false }) ??
        lunarToSolar({ day: 29, month, year: 2026, leap: false })!;
      expect(
        nextAnniversary({ day: 30, month, calendar: 'LUNAR' }, TODAY)?.date,
      ).toEqual(expected);
    }
  });
  it('trước Tết (năm âm chưa sang) → giỗ mùng 1 Tết là Tết sắp tới', () => {
    const today = s(20, 1, 2027);
    const expected = lunarToSolar({
      day: 1,
      month: 1,
      year: 2027,
      leap: false,
    })!;
    expect(
      nextAnniversary({ day: 1, month: 1, calendar: 'LUNAR' }, today),
    ).toEqual({ date: expected, daysLeft: days(today, expected) });
  });
  it('đầu năm 1800 (năm âm 1799 ngoài phạm vi) → không lỗi, lấy Tết 1800', () => {
    const today = s(1, 1, 1800);
    expect(
      nextAnniversary({ day: 1, month: 1, calendar: 'LUNAR' }, today),
    ).toEqual({ date: s(25, 1, 1800), daysLeft: 24 });
  });
  it('vượt phạm vi lịch âm → null', () => {
    expect(
      nextAnniversary({ day: 1, month: 1, calendar: 'LUNAR' }, s(31, 12, 2199)),
    ).toBeNull();
  });
});

describe('nextAnniversary — dương lịch', () => {
  it('hôm nay → 0 ngày', () => {
    expect(
      nextAnniversary({ day: 3, month: 10, calendar: 'SOLAR' }, TODAY),
    ).toEqual({ date: TODAY, daysLeft: 0 });
  });
  it('hôm qua → năm sau, 364 ngày', () => {
    expect(
      nextAnniversary({ day: 2, month: 10, calendar: 'SOLAR' }, TODAY),
    ).toEqual({ date: s(2, 10, 2027), daysLeft: 364 });
  });
  it('qua năm mới', () => {
    expect(
      nextAnniversary({ day: 1, month: 1, calendar: 'SOLAR' }, s(31, 12, 2026)),
    ).toEqual({ date: s(1, 1, 2027), daysLeft: 1 });
  });
  it('29/02 năm không nhuận → 28/02; năm nhuận giữ 29/02', () => {
    expect(
      nextAnniversary({ day: 29, month: 2, calendar: 'SOLAR' }, TODAY)?.date,
    ).toEqual(s(28, 2, 2027));
    expect(
      nextAnniversary({ day: 29, month: 2, calendar: 'SOLAR' }, s(1, 3, 2027))
        ?.date,
    ).toEqual(s(29, 2, 2028));
  });
});
