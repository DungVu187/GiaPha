import { describe, expect, it } from 'vitest';
import {
  checkPartialDateShape,
  formatPartialDate,
  isCompleteDate,
  isLeapYear,
  solarDaysInMonth,
  validateLunarPartialDate,
  validateSolarPartialDate,
  type PartialDate,
} from './partial-date.js';

const TODAY = { year: 2026, month: 10, day: 3 };
const d = (
  year: number | null,
  month: number | null = null,
  day: number | null = null,
): PartialDate => ({ year, month, day });

describe('isLeapYear / solarDaysInMonth', () => {
  it.each([
    [2000, true],
    [1900, false],
    [2024, true],
    [2026, false],
  ])('%i nhuận = %s', (y, leap) => {
    expect(isLeapYear(y)).toBe(leap);
  });
  it('tháng 2', () => {
    expect(solarDaysInMonth(2, 2024)).toBe(29);
    expect(solarDaysInMonth(2, 2026)).toBe(28);
    expect(solarDaysInMonth(4, 2026)).toBe(30);
    expect(solarDaysInMonth(12, 2026)).toBe(31);
  });
});

describe('checkPartialDateShape', () => {
  it.each([d(null), d(1920), d(1920, 7), d(1920, 7, 18)])('hợp lệ: %j', (v) => {
    expect(checkPartialDateShape(v)).toBeNull();
  });
  it('có ngày mà thiếu tháng', () => {
    expect(checkPartialDateShape(d(1920, null, 18))).toBe(
      'Có ngày thì phải có tháng.',
    );
  });
  it('có tháng mà thiếu năm', () => {
    expect(checkPartialDateShape(d(null, 7))).toBe('Có tháng thì phải có năm.');
    expect(checkPartialDateShape(d(null, 7, 18))).toBe(
      'Có tháng thì phải có năm.',
    );
  });
  it('không phải số nguyên', () => {
    expect(checkPartialDateShape(d(1920.5))).toBe(
      'Ngày tháng phải là số nguyên.',
    );
  });
});

describe('validateSolarPartialDate', () => {
  it.each([
    d(null),
    d(1920),
    d(2026, 10),
    d(2026, 10, 3),
    d(2024, 2, 29),
    d(1, 1, 1),
  ])('hợp lệ: %j', (v) => {
    expect(validateSolarPartialDate(v, TODAY)).toBeNull();
  });
  it.each([
    [d(0), 'Năm không hợp lệ.'],
    [d(1920, 13), 'Tháng không hợp lệ.'],
    [d(1920, 0), 'Tháng không hợp lệ.'],
    [d(2026, 2, 29), 'Ngày không hợp lệ.'],
    [d(1920, 4, 31), 'Ngày không hợp lệ.'],
    [d(1920, 1, 0), 'Ngày không hợp lệ.'],
    [d(2027), 'Ngày không được ở tương lai.'],
    [d(2026, 11), 'Ngày không được ở tương lai.'],
    [d(2026, 10, 4), 'Ngày không được ở tương lai.'],
    [d(1920, null, 5), 'Có ngày thì phải có tháng.'],
  ])('%j → %s', (v, msg) => {
    expect(validateSolarPartialDate(v, TODAY)).toBe(msg);
  });
});

describe('validateLunarPartialDate', () => {
  it.each([d(null), d(1985), d(1985, 11), d(1985, 11, 30), d(2026, 8, 23)])(
    'hợp lệ: %j',
    (v) => {
      expect(validateLunarPartialDate(v, TODAY)).toBeNull();
    },
  );
  it.each([
    [d(1985, 11, 31), 'Ngày âm lịch chỉ từ 1 đến 30.'],
    [d(1985, 13), 'Tháng không hợp lệ.'],
    [d(2027), 'Ngày không được ở tương lai.'],
    [d(null, 3), 'Có tháng thì phải có năm.'],
  ])('%j → %s', (v, msg) => {
    expect(validateLunarPartialDate(v, TODAY)).toBe(msg);
  });
});

describe('isCompleteDate / formatPartialDate', () => {
  it('đủ ba phần mới là complete', () => {
    expect(isCompleteDate(d(1920, 7, 18))).toBe(true);
    expect(isCompleteDate(d(1920, 7))).toBe(false);
  });
  it.each([
    [d(null), ''],
    [d(1920), '1920'],
    [d(1920, 7), '07/1920'],
    [d(1920, 7, 18), '18/07/1920'],
    [d(5, 1, 2), '02/01/5'],
  ])('%j → %j', (v, s) => {
    expect(formatPartialDate(v)).toBe(s);
  });
});
