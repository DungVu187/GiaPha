import { Controller, Get, Query } from '@nestjs/common';
import { suggestAnniversary, todayInVietnam } from '../lib/anniversary.js';
import { isLunarSupportedYear, lunarToSolar } from '../lib/lunar.js';
import {
  isCompleteDate,
  validateLunarPartialDate,
  validateSolarPartialDate,
  type PartialDate,
} from '../lib/partial-date.js';
import { INVALID, ServiceError } from './member-service.js';

// Thiếu / rỗng → null; không phải chuỗi số (kể cả dạng mảng) → NaN để báo lỗi.
const num = (v: unknown) =>
  v === undefined || v === ''
    ? null
    : typeof v === 'string' && /^\d+$/.test(v)
      ? Number(v)
      : NaN;

@Controller('calendar')
export class CalendarController {
  @Get('anniversary-suggestion')
  suggestion(@Query() q: Record<string, unknown>) {
    const calendar = q.calendar;
    if (calendar !== 'SOLAR' && calendar !== 'LUNAR') {
      throw new ServiceError(400, INVALID, {
        calendar: 'Chọn lịch cho ngày mất.',
      });
    }
    const date: PartialDate = {
      year: num(q.year),
      month: num(q.month),
      day: num(q.day),
    };
    const today = todayInVietnam();
    const error =
      calendar === 'SOLAR'
        ? validateSolarPartialDate(date, today)
        : validateLunarPartialDate(date, today);
    if (error) throw new ServiceError(400, INVALID, { date: error });
    // Ngày âm đủ ba phần nhưng không tồn tại (ngày 30 của tháng thiếu): không gợi ý, vì
    // lưu với ngày mất này sẽ bị 400 — cùng kiểm tra như member-input (form không gửi tháng nhuận).
    if (
      calendar === 'LUNAR' &&
      isCompleteDate(date) &&
      isLunarSupportedYear(date.year) &&
      lunarToSolar({ ...date, leap: false }) === null
    )
      return { suggestion: null };
    return { suggestion: suggestAnniversary(date, calendar) };
  }
}
