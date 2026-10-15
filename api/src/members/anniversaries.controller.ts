import { Controller, Get } from '@nestjs/common';
import { todayInVietnam, upcomingAnniversaries } from '../lib/anniversary.js';
import {
  isLunarSupportedYear,
  lunarYearName,
  solarToLunar,
} from '../lib/lunar.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Mọi tài khoản đã đăng nhập đều xem được lịch giỗ (spec §5).
@Controller('anniversaries')
export class AnniversariesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const today = todayInVietnam();
    const members = await this.prisma.member.findMany({
      where: {
        isDeceased: true,
        anniversaryDay: { not: null },
        anniversaryMonth: { not: null },
        anniversaryCalendar: { not: null },
      },
      select: {
        id: true,
        fullName: true,
        generation: true,
        avatarPath: true,
        isDeceased: true,
        anniversaryDay: true,
        anniversaryMonth: true,
        anniversaryCalendar: true,
      },
    });
    const lunar = isLunarSupportedYear(today.year) ? solarToLunar(today) : null;
    return {
      today: {
        solar: today,
        lunar,
        lunarYearName: lunar ? lunarYearName(lunar.year) : null,
      },
      items: upcomingAnniversaries(members, today),
    };
  }
}
