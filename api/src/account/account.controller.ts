import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SESSION_COOKIE, type SessionUser } from '../auth/session.js';
import { readCookie } from '../lib/cookie.js';
import { log } from '../lib/logger.js';
import { INVALID } from '../members/member-service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { changePassword, getAccount, updateEmail } from './account.js';

const bodyOf = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};

// Tài khoản của chính người đang đăng nhập (mọi vai trò).
@Controller('account')
export class AccountController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  get(@CurrentUser() user: SessionUser) {
    return getAccount(this.prisma, user.id);
  }

  @Put('email')
  async email(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    const r = await updateEmail(this.prisma, user.id, bodyOf(body).email);
    if (!r.ok)
      throw new BadRequestException({ message: INVALID, errors: r.errors });
    log('info', 'email_updated', { userId: user.id });
    return { email: r.email };
  }

  @Put('password')
  @HttpCode(204)
  async password(
    @CurrentUser() user: SessionUser,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<void> {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE) ?? '';
    const r = await changePassword(this.prisma, user.id, token, bodyOf(body));
    if (!r.ok)
      throw new BadRequestException({ message: INVALID, errors: r.errors });
    log('info', 'password_changed', { userId: user.id });
  }
}
