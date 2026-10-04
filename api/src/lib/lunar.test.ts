import { describe, expect, it } from 'vitest';
import {
  jdFromDate,
  jdToDate,
  leapMonthOfYear,
  lunarToSolar,
  solarToLunar,
} from './lunar.js';

const s = (day: number, month: number, year: number) => ({ day, month, year });
const l = (day: number, month: number, year: number, leap = false) => ({
  day,
  month,
  year,
  leap,
});

describe('jdFromDate / jdToDate', () => {
  it('mốc J2000', () => {
    expect(jdFromDate(1, 1, 2000)).toBe(2451545);
    expect(jdToDate(2451545)).toEqual(s(1, 1, 2000));
  });
});

describe('Tết Nguyên Đán (mùng 1 tháng Giêng)', () => {
  it.each([
    [s(25, 1, 2020), 2020],
    [s(12, 2, 2021), 2021],
    [s(1, 2, 2022), 2022],
    [s(22, 1, 2023), 2023],
    [s(10, 2, 2024), 2024],
    [s(29, 1, 2025), 2025],
    [s(17, 2, 2026), 2026],
    [s(29, 1, 1968), 1968],
    // Múi giờ +7: Tết Ất Sửu ở Việt Nam là 21/01/1985 (Trung Quốc 20/02/1985).
    [s(21, 1, 1985), 1985],
  ])('%j là 1/1/%i âm lịch', (solar, year) => {
    expect(solarToLunar(solar)).toEqual(l(1, 1, year));
    expect(lunarToSolar(l(1, 1, year))).toEqual(solar);
  });
});

describe('tháng nhuận', () => {
  it.each([
    [2020, 4],
    [2023, 2],
    [2025, 6],
    [2026, 0],
    [2028, 5],
    [2033, 11],
  ])('năm %i nhuận tháng %i', (y, m) => {
    expect(leapMonthOfYear(y)).toBe(m);
  });

  it('2023 nhuận tháng 2: 1/2 nhuận = 22/03/2023, 1/3 = 20/04/2023', () => {
    expect(lunarToSolar(l(1, 2, 2023, true))).toEqual(s(22, 3, 2023));
    expect(solarToLunar(s(22, 3, 2023))).toEqual(l(1, 2, 2023, true));
    expect(lunarToSolar(l(1, 3, 2023))).toEqual(s(20, 4, 2023));
  });

  it('2020 nhuận tháng 4: 1/4 nhuận = 23/05/2020', () => {
    expect(lunarToSolar(l(1, 4, 2020, true))).toEqual(s(23, 5, 2020));
  });

  it('2025 nhuận tháng 6: 1/6 nhuận = 25/07/2025', () => {
    expect(lunarToSolar(l(1, 6, 2025, true))).toEqual(s(25, 7, 2025));
  });

  // Ca hiếm: nhuận tháng 11 năm 2033 (theo bản gốc Hồ Ngọc Đức, múi giờ +7).
  it('2033 nhuận tháng 11: 1/11 nhuận = 22/12/2033', () => {
    expect(lunarToSolar(l(1, 11, 2033, true))).toEqual(s(22, 12, 2033));
    expect(solarToLunar(s(22, 12, 2033))).toEqual(l(1, 11, 2033, true));
    expect(solarToLunar(s(21, 12, 2033))).toEqual(l(30, 11, 2033));
    expect(lunarToSolar(l(1, 12, 2033))).toEqual(s(20, 1, 2034));
  });

  it('cờ nhuận sai → null', () => {
    expect(lunarToSolar(l(1, 3, 2023, true))).toBeNull();
    expect(lunarToSolar(l(1, 1, 2026, true))).toBeNull();
    expect(lunarToSolar(l(1, 12, 2033, true))).toBeNull();
  });
});

describe('mốc khác', () => {
  it('Trung thu 2026 = 25/09/2026; 03/10/2026 = 23/8 âm', () => {
    expect(lunarToSolar(l(15, 8, 2026))).toEqual(s(25, 9, 2026));
    expect(solarToLunar(s(3, 10, 2026))).toEqual(l(23, 8, 2026));
  });
});

describe('ngày 30', () => {
  it('mỗi tháng năm 2025 (kể cả nhuận 6): ngày 30 hoặc tồn tại đúng, hoặc trả null; có tháng thiếu', () => {
    const months = [
      ...Array.from({ length: 12 }, (_, i) => l(30, i + 1, 2025)),
      l(30, 6, 2025, true),
    ];
    let missing = 0;
    for (const m of months) {
      const solar = lunarToSolar(m);
      if (solar === null) missing++;
      else expect(solarToLunar(solar)).toEqual(m);
    }
    expect(missing).toBeGreaterThan(0);
    expect(missing).toBeLessThan(13);
  });
});

describe('chuyển đổi hai chiều', () => {
  it('mọi ngày 2019–2027: lunarToSolar(solarToLunar(x)) = x', () => {
    for (
      let jd = jdFromDate(1, 1, 2019);
      jd <= jdFromDate(31, 12, 2027);
      jd++
    ) {
      const solar = jdToDate(jd);
      expect(lunarToSolar(solarToLunar(solar))).toEqual(solar);
    }
  });
});

describe('phạm vi hỗ trợ', () => {
  it('ngoài 1800–2199 → RangeError', () => {
    expect(() => solarToLunar(s(1, 1, 1799))).toThrow(RangeError);
    expect(() => solarToLunar(s(1, 1, 2200))).toThrow(RangeError);
    expect(() => lunarToSolar(l(1, 1, 1799))).toThrow(RangeError);
    expect(() => lunarToSolar(l(1, 1, 2200))).toThrow(RangeError);
    expect(() => leapMonthOfYear(1799)).toThrow(RangeError);
  });

  it('biên 1800 và 2199 vẫn đổi được', () => {
    // 01/01/1800 dương lịch còn thuộc năm âm 1799 → đổi ngược bị chặn vì năm âm ngoài phạm vi.
    const early = solarToLunar(s(1, 1, 1800));
    expect(early.year).toBe(1799);
    expect(() => lunarToSolar(early)).toThrow(RangeError);
    const tet1800 = lunarToSolar(l(1, 1, 1800));
    expect(tet1800?.year).toBe(1800);
    if (tet1800) expect(solarToLunar(tet1800)).toEqual(l(1, 1, 1800));
    expect(lunarToSolar(solarToLunar(s(31, 12, 2199)))).toEqual(
      s(31, 12, 2199),
    );
  });
});
