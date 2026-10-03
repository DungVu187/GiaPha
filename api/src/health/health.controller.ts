import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { checkHealth, type HealthResult } from './health.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async get(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthResult['body']> {
    const { httpStatus, body } = await checkHealth(
      () => this.prisma.$queryRaw`SELECT 1`,
      process.env.APP_VERSION ?? 'dev',
    );
    res.status(httpStatus);
    return body;
  }
}
