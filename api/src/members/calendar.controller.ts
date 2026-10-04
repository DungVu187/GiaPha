import { Controller, Get, Query } from '@nestjs/common';
import { suggestAnniversary, todayInVietnam } from '../lib/anniversary.js';
import {
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
    return { suggestion: suggestAnniversary(date, calendar) };
  }
}
