import {
  isCompleteDate,
  isLeapYear,
  type PartialDate,
  type SimpleDate,
} from './partial-date.js';
import {
  isLunarSupportedYear,
  jdFromDate,
  lunarToSolar,
  solarToLunar,
} from './lunar.js';

export type CalendarType = 'SOLAR' | 'LUNAR';
export type Anniversary = {
  day: number;
  month: number;
  calendar: CalendarType;
};
export type NextAnniversary = { date: SimpleDate; daysLeft: number };

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export function todayInVietnam(now: Date = new Date()): SimpleDate {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  return {
    year: vn.getUTCFullYear(),
    month: vn.getUTCMonth() + 1,
    day: vn.getUTCDate(),
  };
}

export function suggestAnniversary(
  death: PartialDate,
  calendar: CalendarType | null,
): Anniversary | null {
  if (calendar === 'LUNAR' && death.month !== null && death.day !== null) {
    return { day: death.day, month: death.month, calendar: 'LUNAR' };
  }
  if (
    calendar === 'SOLAR' &&
    isCompleteDate(death) &&
    isLunarSupportedYear(death.year)
  ) {
    const lunar = solarToLunar(death);
    return { day: lunar.day, month: lunar.month, calendar: 'LUNAR' };
  }
  return null;
}

const jd = (d: SimpleDate) => jdFromDate(d.day, d.month, d.year);

function lunarOccurrence(
  day: number,
  month: number,
  lunarYear: number,
): SimpleDate | null {
  if (!isLunarSupportedYear(lunarYear)) return null;
  return (
    lunarToSolar({ day, month, year: lunarYear, leap: false }) ??
    (day === 30
      ? lunarToSolar({ day: 29, month, year: lunarYear, leap: false })
      : null)
  );
}

function solarOccurrence(day: number, month: number, year: number): SimpleDate {
  return {
    day: month === 2 && day === 29 && !isLeapYear(year) ? 28 : day,
    month,
    year,
  };
}

export function nextAnniversary(
  a: Anniversary,
  today: SimpleDate,
): NextAnniversary | null {
  const todayJd = jd(today);
  let date: SimpleDate | null;
  if (a.calendar === 'SOLAR') {
    date = solarOccurrence(a.day, a.month, today.year);
    if (jd(date) < todayJd)
      date = solarOccurrence(a.day, a.month, today.year + 1);
  } else {
    if (!isLunarSupportedYear(today.year)) return null;
    const lunarYear = solarToLunar(today).year;
    date = lunarOccurrence(a.day, a.month, lunarYear);
    if (date === null || jd(date) < todayJd)
      date = lunarOccurrence(a.day, a.month, lunarYear + 1);
  }
  return date ? { date, daysLeft: jd(date) - todayJd } : null;
}
