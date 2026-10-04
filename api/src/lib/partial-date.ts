export type PartialDate = {
  year: number | null;
  month: number | null;
  day: number | null;
};
export type SimpleDate = { year: number; month: number; day: number };

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function solarDaysInMonth(month: number, year: number): number {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
}

export function isCompleteDate(d: PartialDate): d is SimpleDate {
  return d.year !== null && d.month !== null && d.day !== null;
}

// Hợp lệ: rỗng | năm | năm+tháng | đủ ba (spec §3).
export function checkPartialDateShape(d: PartialDate): string | null {
  for (const v of [d.year, d.month, d.day]) {
    if (v !== null && !Number.isInteger(v))
      return 'Ngày tháng phải là số nguyên.';
  }
  if (d.day !== null && d.month === null) return 'Có ngày thì phải có tháng.';
  if (d.month !== null && d.year === null) return 'Có tháng thì phải có năm.';
  return null;
}

function isFuture(d: PartialDate, today: SimpleDate): boolean {
  if (d.year === null) return false;
  if (d.year !== today.year) return d.year > today.year;
  if (d.month === null) return false;
  if (d.month !== today.month) return d.month > today.month;
  return d.day !== null && d.day > today.day;
}

function checkCommon(d: PartialDate): string | null {
  const shape = checkPartialDateShape(d);
  if (shape) return shape;
  if (d.year !== null && d.year < 1) return 'Năm không hợp lệ.';
  if (d.month !== null && (d.month < 1 || d.month > 12))
    return 'Tháng không hợp lệ.';
  return null;
}

export function validateSolarPartialDate(
  d: PartialDate,
  today: SimpleDate,
): string | null {
  const common = checkCommon(d);
  if (common) return common;
  if (
    d.day !== null &&
    (d.day < 1 || d.day > solarDaysInMonth(d.month as number, d.year as number))
  ) {
    return 'Ngày không hợp lệ.';
  }
  return isFuture(d, today) ? 'Ngày không được ở tương lai.' : null;
}

export function validateLunarPartialDate(
  d: PartialDate,
  today: SimpleDate,
): string | null {
  const common = checkCommon(d);
  if (common) return common;
  if (d.day !== null && (d.day < 1 || d.day > 30))
    return 'Ngày âm lịch chỉ từ 1 đến 30.';
  // Năm âm không bao giờ lớn hơn năm dương hiện tại.
  return d.year !== null && d.year > today.year
    ? 'Ngày không được ở tương lai.'
    : null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatPartialDate(d: PartialDate): string {
  if (d.year === null) return '';
  if (d.month === null) return String(d.year);
  if (d.day === null) return `${pad2(d.month)}/${d.year}`;
  return `${pad2(d.day)}/${pad2(d.month)}/${d.year}`;
}
