// Port thuật toán âm lịch Việt Nam của Hồ Ngọc Đức (https://www.informatik.uni-leipzig.de/~duc/amlich/),
// múi giờ +7 — không dùng thư viện lịch Trung Quốc (spec §3).
import type { SimpleDate } from './partial-date.js';

export const VN_TIMEZONE = 7;
export const LUNAR_MIN_YEAR = 1800;
export const LUNAR_MAX_YEAR = 2199;

export type LunarDate = {
  day: number;
  month: number;
  year: number;
  leap: boolean;
};

const INT = Math.floor;
const PI = Math.PI;

export function isLunarSupportedYear(year: number): boolean {
  return year >= LUNAR_MIN_YEAR && year <= LUNAR_MAX_YEAR;
}

function assertSupported(year: number): void {
  if (!isLunarSupportedYear(year)) {
    throw new RangeError(`Chỉ hỗ trợ năm ${LUNAR_MIN_YEAR}–${LUNAR_MAX_YEAR}`);
  }
}

export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    INT((153 * m + 2) / 5) +
    365 * y +
    INT(y / 4) -
    INT(y / 100) +
    INT(y / 400) -
    32045;
  if (jd < 2299161)
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}

export function jdToDate(jd: number): SimpleDate {
  let b: number;
  let c: number;
  if (jd > 2299160) {
    const a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  return {
    day: e - INT((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * INT(m / 10),
    year: b * 100 + d - 4800 + INT(m / 10),
  };
}

function newMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 =
    C1 -
    0.0074 * Math.sin(dr * (M - Mpr)) +
    0.0004 * Math.sin(dr * (2 * F + M));
  C1 =
    C1 -
    0.0004 * Math.sin(dr * (2 * F - M)) -
    0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 =
    C1 +
    0.001 * Math.sin(dr * (2 * F - Mpr)) +
    0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 +
        0.000839 * T +
        0.0002261 * T2 -
        0.00000845 * T3 -
        0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return jd1 + C1 - deltat;
}

function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL +=
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L -= PI * 2 * INT(L / (PI * 2));
  return L;
}

function getSunLongitude(dayNumber: number, tz: number): number {
  return INT((sunLongitude(dayNumber - 0.5 - tz / 24) / PI) * 6);
}

function getNewMoonDay(k: number, tz: number): number {
  return INT(newMoon(k) + 0.5 + tz / 24);
}

function getLunarMonth11(yy: number, tz: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, tz);
  if (getSunLongitude(nm, tz) >= 9) nm = getNewMoonDay(k - 1, tz);
  return nm;
}

function getLeapMonthOffset(a11: number, tz: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last: number;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, tz), tz);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, tz), tz);
  } while (arc !== last && i < 14);
  return i - 1;
}

export function solarToLunar(date: SimpleDate): LunarDate {
  assertSupported(date.year);
  const tz = VN_TIMEZONE;
  const dayNumber = jdFromDate(date.day, date.month, date.year);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, tz);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k, tz);
  let a11 = getLunarMonth11(date.year, tz);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = date.year;
    a11 = getLunarMonth11(date.year - 1, tz);
  } else {
    lunarYear = date.year + 1;
    b11 = getLunarMonth11(date.year + 1, tz);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let leap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, tz);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) leap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap };
}

// Bản gốc không kiểm ngày 30 hay cờ nhuận; ở đây đổi xong đổi ngược lại để chắc ngày âm tồn tại.
export function lunarToSolar(date: LunarDate): SimpleDate | null {
  assertSupported(date.year);
  const tz = VN_TIMEZONE;
  let a11: number;
  let b11: number;
  if (date.month < 11) {
    a11 = getLunarMonth11(date.year - 1, tz);
    b11 = getLunarMonth11(date.year, tz);
  } else {
    a11 = getLunarMonth11(date.year, tz);
    b11 = getLunarMonth11(date.year + 1, tz);
  }
  let off = date.month - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, tz);
    let leapMonth = leapOff - 2;
    if (leapMonth <= 0) leapMonth += 12;
    if (date.leap && date.month !== leapMonth) return null;
    if (date.leap || off >= leapOff) off += 1;
  } else if (date.leap) {
    return null;
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  const monthStart = getNewMoonDay(k + off, tz);
  const solar = jdToDate(monthStart + date.day - 1);
  if (!isLunarSupportedYear(solar.year)) return null;
  const back = solarToLunar(solar);
  const same =
    back.day === date.day &&
    back.month === date.month &&
    back.year === date.year &&
    back.leap === date.leap;
  return same ? solar : null;
}

// Tháng nhuận trong khoảng từ tháng 11 năm (y-1) tới tháng 11 năm y; 0 nếu không nhuận.
function leapMonthInSpan(a11: number, b11: number, tz: number): number {
  if (b11 - a11 <= 365) return 0;
  const leapMonth = getLeapMonthOffset(a11, tz) - 2;
  return leapMonth <= 0 ? leapMonth + 12 : leapMonth;
}

export function leapMonthOfYear(lunarYear: number): number {
  assertSupported(lunarYear);
  const tz = VN_TIMEZONE;
  const prev11 = getLunarMonth11(lunarYear - 1, tz);
  const this11 = getLunarMonth11(lunarYear, tz);
  const next11 = getLunarMonth11(lunarYear + 1, tz);
  // Khoảng (11/y-1 → 11/y) chứa tháng 11, 12 của năm trước và tháng 1–10 của năm nay.
  const early = leapMonthInSpan(prev11, this11, tz);
  if (early >= 1 && early <= 10) return early;
  // Nhuận tháng 11/12 của năm nay nằm ở khoảng (11/y → 11/y+1).
  const late = leapMonthInSpan(this11, next11, tz);
  return late === 11 || late === 12 ? late : 0;
}
