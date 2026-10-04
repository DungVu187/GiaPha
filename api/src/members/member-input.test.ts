import { describe, expect, it } from 'vitest';
import { parseMemberInput } from './member-input.js';

const TODAY = { year: 2026, month: 10, day: 3 };
const base = { fullName: '  vũ   văn an ', gender: 'MALE' };
const parse = (body: Record<string, unknown>) => parseMemberInput(body, TODAY);
const errorsOf = (body: Record<string, unknown>) => {
  const r = parse(body);
  if (r.ok) throw new Error('mong đợi lỗi');
  return r.errors;
};
const valueOf = (body: Record<string, unknown>) => {
  const r = parse(body);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};

describe('parseMemberInput — cơ bản', () => {
  it('tối thiểu: chỉ họ tên → giá trị mặc định', () => {
    expect(valueOf({ fullName: 'vũ văn an' })).toEqual({
      fullName: 'VŨ VĂN AN',
      gender: null,
      generation: null,
      birthOrder: null,
      birth: { year: null, month: null, day: null },
      isDeceased: false,
      death: { year: null, month: null, day: null },
      deathCalendar: null,
      deathLunarLeap: false,
      anniversary: null,
      burialPlace: null,
      note: null,
      fatherId: null,
      motherId: null,
    });
  });

  it('body không phải object → lỗi họ tên', () => {
    expect(parseMemberInput(null, TODAY)).toEqual({
      ok: false,
      errors: { fullName: 'Vui lòng nhập họ tên.' },
    });
  });

  it.each([
    [{ fullName: '   ' }, 'fullName', 'Vui lòng nhập họ tên.'],
    [{ fullName: 'A'.repeat(101) }, 'fullName', 'Họ tên tối đa 100 ký tự.'],
    [{ ...base, gender: 'OTHER' }, 'gender', 'Giới tính không hợp lệ.'],
    [
      { ...base, generation: 0 },
      'generation',
      'Đời phải là số nguyên từ 1 đến 200.',
    ],
    [
      { ...base, generation: '3' },
      'generation',
      'Đời phải là số nguyên từ 1 đến 200.',
    ],
    [
      { ...base, birthOrder: 0 },
      'birthOrder',
      'Thứ tự phải là số nguyên từ 1 đến 99.',
    ],
    [
      { ...base, birthYear: 1920, birthDay: 5 },
      'birthDate',
      'Có ngày thì phải có tháng.',
    ],
    [{ ...base, birthYear: 2030 }, 'birthDate', 'Ngày không được ở tương lai.'],
    [{ ...base, isDeceased: 'yes' }, 'isDeceased', 'Trạng thái không hợp lệ.'],
    [{ ...base, note: 'x'.repeat(2001) }, 'note', 'Ghi chú tối đa 2000 ký tự.'],
    [{ ...base, fatherId: -1 }, 'fatherId', 'Mã thành viên không hợp lệ.'],
    [
      { ...base, fatherId: 5, motherId: 5 },
      'motherId',
      'Bố và mẹ không thể là cùng một người.',
    ],
  ])('%j → %s: %s', (body, key, msg) => {
    expect(errorsOf(body)[key]).toBe(msg);
  });

  it.each([
    ['fatherId', 'Mã thành viên không hợp lệ.'],
    ['motherId', 'Mã thành viên không hợp lệ.'],
    ['generation', 'Đời phải là số nguyên từ 1 đến 200.'],
    ['birthOrder', 'Thứ tự phải là số nguyên từ 1 đến 99.'],
  ])('%s vượt 32-bit → lỗi', (key, msg) => {
    expect(errorsOf({ ...base, [key]: 2147483648 })[key]).toBe(msg);
  });

  it('fatherId/motherId = 2147483647 hợp lệ', () => {
    const v = valueOf({ ...base, fatherId: 2147483647, motherId: 2147483646 });
    expect([v.fatherId, v.motherId]).toEqual([2147483647, 2147483646]);
  });

  it('gom nhiều lỗi một lần', () => {
    expect(
      Object.keys(errorsOf({ fullName: '', gender: 'X', generation: 0 })),
    ).toEqual(['fullName', 'gender', 'generation']);
  });

  it('ngày sinh không đầy đủ hợp lệ', () => {
    expect(valueOf({ ...base, birthYear: 1920, birthMonth: 7 }).birth).toEqual({
      year: 1920,
      month: 7,
      day: null,
    });
  });

  it('ghi chú rỗng → null, có nội dung thì trim', () => {
    expect(valueOf({ ...base, note: '   ' }).note).toBeNull();
    expect(valueOf({ ...base, note: '  Trưởng chi  ' }).note).toBe(
      'Trưởng chi',
    );
  });
});

describe('parseMemberInput — còn sống / đã khuất', () => {
  it('còn sống: bỏ qua mọi trường đã khuất', () => {
    const v = valueOf({
      ...base,
      deathYear: 1998,
      deathCalendar: 'SOLAR',
      anniversaryDay: 12,
      anniversaryMonth: 3,
      anniversaryCalendar: 'LUNAR',
      burialPlace: 'Đồng Lạc',
    });
    expect(v.death).toEqual({ year: null, month: null, day: null });
    expect(v.deathCalendar).toBeNull();
    expect(v.anniversary).toBeNull();
    expect(v.burialPlace).toBeNull();
  });

  it('đã khuất, ngày mất dương đủ, không nhập giỗ → tự gợi ý giỗ âm', () => {
    const v = valueOf({
      ...base,
      isDeceased: true,
      deathYear: 2026,
      deathMonth: 9,
      deathDay: 25,
      deathCalendar: 'SOLAR',
    });
    expect(v.anniversary).toEqual({ day: 15, month: 8, calendar: 'LUNAR' });
  });

  it('đã khuất, nhập giỗ tay → giữ giỗ tay', () => {
    const v = valueOf({
      ...base,
      isDeceased: true,
      deathYear: 2026,
      deathMonth: 9,
      deathDay: 25,
      deathCalendar: 'SOLAR',
      anniversaryDay: 25,
      anniversaryMonth: 9,
      anniversaryCalendar: 'SOLAR',
    });
    expect(v.anniversary).toEqual({ day: 25, month: 9, calendar: 'SOLAR' });
  });

  it('đã khuất, không biết ngày mất → không có giỗ gợi ý', () => {
    const v = valueOf({
      ...base,
      isDeceased: true,
      burialPlace: '  Nghĩa trang làng ',
    });
    expect(v.anniversary).toBeNull();
    expect(v.burialPlace).toBe('Nghĩa trang làng');
  });

  it('ngày mất âm lịch nhuận đúng tháng nhuận', () => {
    const v = valueOf({
      ...base,
      isDeceased: true,
      deathYear: 2023,
      deathMonth: 2,
      deathDay: 10,
      deathCalendar: 'LUNAR',
      deathLunarLeap: true,
    });
    expect(v.deathLunarLeap).toBe(true);
    expect(v.anniversary).toEqual({ day: 10, month: 2, calendar: 'LUNAR' });
  });

  it.each([
    [{ deathYear: 1998 }, 'deathCalendar', 'Chọn lịch cho ngày mất.'],
    [
      { deathYear: 1998, deathCalendar: 'X' },
      'deathCalendar',
      'Lịch không hợp lệ.',
    ],
    [
      { deathYear: 1998, deathMonth: 2, deathDay: 30, deathCalendar: 'SOLAR' },
      'deathDate',
      'Ngày không hợp lệ.',
    ],
    [
      { deathYear: 1985, deathMonth: 11, deathDay: 31, deathCalendar: 'LUNAR' },
      'deathDate',
      'Ngày âm lịch chỉ từ 1 đến 30.',
    ],
    [
      {
        deathYear: 2026,
        deathMonth: 3,
        deathDay: 2,
        deathCalendar: 'LUNAR',
        deathLunarLeap: true,
      },
      'deathLunarLeap',
      'Năm này không có tháng nhuận đó.',
    ],
    [
      { deathYear: 1998, deathCalendar: 'SOLAR', deathLunarLeap: true },
      'deathLunarLeap',
      'Chỉ chọn tháng nhuận cho ngày mất âm lịch có tháng.',
    ],
    [
      { birthYear: 1950, deathYear: 1940, deathCalendar: 'SOLAR' },
      'deathDate',
      'Ngày mất phải sau ngày sinh.',
    ],
    [{ anniversaryDay: 12 }, 'anniversary', 'Ngày giỗ cần cả ngày và tháng.'],
    [
      { anniversaryDay: 12, anniversaryMonth: 3 },
      'anniversary',
      'Chọn lịch cho ngày giỗ.',
    ],
    [
      { anniversaryDay: 31, anniversaryMonth: 3, anniversaryCalendar: 'LUNAR' },
      'anniversary',
      'Ngày giỗ không hợp lệ.',
    ],
    [
      { anniversaryDay: 30, anniversaryMonth: 2, anniversaryCalendar: 'SOLAR' },
      'anniversary',
      'Ngày giỗ không hợp lệ.',
    ],
    [
      { anniversaryDay: 1, anniversaryMonth: 13, anniversaryCalendar: 'SOLAR' },
      'anniversary',
      'Ngày giỗ không hợp lệ.',
    ],
    [
      { burialPlace: 'x'.repeat(201) },
      'burialPlace',
      'Nơi an táng tối đa 200 ký tự.',
    ],
  ])('đã khuất %j → %s', (extra, key, msg) => {
    expect(errorsOf({ ...base, isDeceased: true, ...extra })[key]).toBe(msg);
  });

  it('giỗ dương 29/02 hợp lệ', () => {
    expect(
      valueOf({
        ...base,
        isDeceased: true,
        anniversaryDay: 29,
        anniversaryMonth: 2,
        anniversaryCalendar: 'SOLAR',
      }).anniversary,
    ).toEqual({ day: 29, month: 2, calendar: 'SOLAR' });
  });
});
