import type { Anniversary, CalendarType } from '../lib/anniversary.js';
import { suggestAnniversary } from '../lib/anniversary.js';
import {
  isLunarSupportedYear,
  leapMonthOfYear,
  lunarToSolar,
} from '../lib/lunar.js';
import { normalizeFullName } from '../lib/name.js';
import {
  isCompleteDate,
  solarDaysInMonth,
  validateLunarPartialDate,
  validateSolarPartialDate,
  type PartialDate,
  type SimpleDate,
} from '../lib/partial-date.js';

export type GenderValue = 'MALE' | 'FEMALE';
export type MemberInput = {
  fullName: string;
  gender: GenderValue | null;
  generation: number | null;
  birthOrder: number | null;
  birth: PartialDate;
  isDeceased: boolean;
  death: PartialDate;
  deathCalendar: CalendarType | null;
  deathLunarLeap: boolean;
  anniversary: Anniversary | null;
  burialPlace: string | null;
  note: string | null;
  fatherId: number | null;
  motherId: number | null;
};
export type FieldErrors = Record<string, string>;

// Giới hạn cột Int (32-bit) của Prisma/Postgres.
const MAX_INT32 = 2147483647;
const EMPTY_DATE: PartialDate = { year: null, month: null, day: null };
const CALENDARS = ['SOLAR', 'LUNAR'] as const;

type Raw = Record<string, unknown>;
const isMissing = (v: unknown) => v === undefined || v === null;
const intOrNull = (v: unknown): number | null | 'invalid' =>
  isMissing(v)
    ? null
    : typeof v === 'number' && Number.isInteger(v)
      ? v
      : 'invalid';

function optionalText(
  raw: Raw,
  key: string,
  max: number,
  label: string,
  errors: FieldErrors,
): string | null {
  const v = raw[key];
  if (isMissing(v)) return null;
  if (typeof v !== 'string') {
    errors[key] = `${label} không hợp lệ.`;
    return null;
  }
  const t = v.trim();
  if (t.length > max) errors[key] = `${label} tối đa ${max} ký tự.`;
  return t || null;
}

function rangedInt(
  raw: Raw,
  key: string,
  min: number,
  max: number,
  message: string,
  errors: FieldErrors,
): number | null {
  const v = intOrNull(raw[key]);
  if (v === 'invalid' || (v !== null && (v < min || v > max))) {
    errors[key] = message;
    return null;
  }
  return v;
}

function partialDate(
  raw: Raw,
  prefix: 'birth' | 'death',
  errors: FieldErrors,
  errorKey: string,
): PartialDate {
  const parts = [`${prefix}Year`, `${prefix}Month`, `${prefix}Day`].map((k) =>
    intOrNull(raw[k]),
  );
  if (parts.includes('invalid')) {
    errors[errorKey] = 'Ngày tháng phải là số nguyên.';
    return EMPTY_DATE;
  }
  const [year, month, day] = parts as (number | null)[];
  return { year, month, day };
}

function calendarOf(v: unknown): CalendarType | null | 'invalid' {
  if (isMissing(v)) return null;
  return CALENDARS.includes(v as CalendarType)
    ? (v as CalendarType)
    : 'invalid';
}

function parseAnniversary(raw: Raw, errors: FieldErrors): Anniversary | null {
  const day = intOrNull(raw.anniversaryDay);
  const month = intOrNull(raw.anniversaryMonth);
  const calendar = calendarOf(raw.anniversaryCalendar);
  if (day === null && month === null) return null;
  if (
    day === 'invalid' ||
    month === 'invalid' ||
    day === null ||
    month === null
  ) {
    errors.anniversary = 'Ngày giỗ cần cả ngày và tháng.';
    return null;
  }
  if (calendar === null || calendar === 'invalid') {
    errors.anniversary = 'Chọn lịch cho ngày giỗ.';
    return null;
  }
  const maxDay =
    calendar === 'LUNAR'
      ? 30
      : month >= 1 && month <= 12
        ? solarDaysInMonth(month, 2000)
        : 0;
  if (month < 1 || month > 12 || day < 1 || day > maxDay) {
    errors.anniversary = 'Ngày giỗ không hợp lệ.';
    return null;
  }
  return { day, month, calendar };
}

export function parseMemberInput(
  body: unknown,
  today: SimpleDate,
): { ok: true; value: MemberInput } | { ok: false; errors: FieldErrors } {
  if (typeof body !== 'object' || body === null)
    return { ok: false, errors: { fullName: 'Vui lòng nhập họ tên.' } };
  const raw = body as Raw;
  const errors: FieldErrors = {};

  const fullName =
    typeof raw.fullName === 'string' ? normalizeFullName(raw.fullName) : '';
  if (!fullName) errors.fullName = 'Vui lòng nhập họ tên.';
  else if (fullName.length > 100) errors.fullName = 'Họ tên tối đa 100 ký tự.';

  let gender: GenderValue | null = null;
  if (!isMissing(raw.gender)) {
    if (raw.gender === 'MALE' || raw.gender === 'FEMALE') gender = raw.gender;
    else errors.gender = 'Giới tính không hợp lệ.';
  }

  const generation = rangedInt(
    raw,
    'generation',
    1,
    200,
    'Đời phải là số nguyên từ 1 đến 200.',
    errors,
  );
  const birthOrder = rangedInt(
    raw,
    'birthOrder',
    1,
    99,
    'Thứ tự phải là số nguyên từ 1 đến 99.',
    errors,
  );

  const birth = partialDate(raw, 'birth', errors, 'birthDate');
  if (!errors.birthDate) {
    const e = validateSolarPartialDate(birth, today);
    if (e) errors.birthDate = e;
  }

  let isDeceased = false;
  if (!isMissing(raw.isDeceased)) {
    if (typeof raw.isDeceased === 'boolean') isDeceased = raw.isDeceased;
    else errors.isDeceased = 'Trạng thái không hợp lệ.';
  }

  let death = EMPTY_DATE;
  let deathCalendar: CalendarType | null = null;
  let deathLunarLeap = false;
  let anniversary: Anniversary | null = null;
  let burialPlace: string | null = null;

  if (isDeceased) {
    death = partialDate(raw, 'death', errors, 'deathDate');
    const hasDeath =
      death.year !== null || death.month !== null || death.day !== null;
    const cal = calendarOf(raw.deathCalendar);
    if (cal === 'invalid') errors.deathCalendar = 'Lịch không hợp lệ.';
    else if (hasDeath && cal === null)
      errors.deathCalendar = 'Chọn lịch cho ngày mất.';
    else deathCalendar = hasDeath ? cal : null;

    if (!errors.deathDate && deathCalendar) {
      const e =
        deathCalendar === 'SOLAR'
          ? validateSolarPartialDate(death, today)
          : validateLunarPartialDate(death, today);
      if (e) errors.deathDate = e;
      else if (
        birth.year !== null &&
        death.year !== null &&
        death.year < birth.year
      ) {
        errors.deathDate = 'Ngày mất phải sau ngày sinh.';
      }
    }

    if (
      !isMissing(raw.deathLunarLeap) &&
      typeof raw.deathLunarLeap !== 'boolean'
    ) {
      errors.deathLunarLeap = 'Tháng nhuận không hợp lệ.';
    } else if (raw.deathLunarLeap === true) {
      if (deathCalendar !== 'LUNAR' || death.month === null) {
        errors.deathLunarLeap =
          'Chỉ chọn tháng nhuận cho ngày mất âm lịch có tháng.';
      } else if (
        death.year !== null &&
        isLunarSupportedYear(death.year) &&
        leapMonthOfYear(death.year) !== death.month
      ) {
        errors.deathLunarLeap = 'Năm này không có tháng nhuận đó.';
      } else {
        deathLunarLeap = true;
      }
    }

    // Ngày âm đủ ba phần: kiểm tháng đó có ngày này (ngày 30) không.
    if (
      !errors.deathDate &&
      !errors.deathLunarLeap &&
      deathCalendar === 'LUNAR' &&
      isCompleteDate(death) &&
      isLunarSupportedYear(death.year)
    ) {
      if (lunarToSolar({ ...death, leap: deathLunarLeap }) === null)
        errors.deathDate = 'Ngày âm lịch này không tồn tại.';
    }

    anniversary = parseAnniversary(raw, errors);
    if (!anniversary && !errors.anniversary && !errors.deathDate)
      anniversary = suggestAnniversary(death, deathCalendar);
    burialPlace = optionalText(raw, 'burialPlace', 200, 'Nơi an táng', errors);
  }

  const note = optionalText(raw, 'note', 2000, 'Ghi chú', errors);

  const fatherId = rangedInt(
    raw,
    'fatherId',
    1,
    MAX_INT32,
    'Mã thành viên không hợp lệ.',
    errors,
  );
  const motherId = rangedInt(
    raw,
    'motherId',
    1,
    MAX_INT32,
    'Mã thành viên không hợp lệ.',
    errors,
  );
  if (fatherId !== null && fatherId === motherId)
    errors.motherId = 'Bố và mẹ không thể là cùng một người.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      fullName,
      gender,
      generation,
      birthOrder,
      birth,
      isDeceased,
      death,
      deathCalendar,
      deathLunarLeap,
      anniversary,
      burialPlace,
      note,
      fatherId,
      motherId,
    },
  };
}
