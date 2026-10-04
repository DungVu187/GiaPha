import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { readCookie } from '../lib/cookie.js';
import { log } from '../lib/logger.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { authenticate } from './authenticate.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import {
  createSession,
  invalidateSession,
  SESSION_COOKIE,
  type SessionUser,
} from './session.js';
import { normalizeUsername } from './username.js';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

// Giới hạn độ dài để không phải băm argon2 chuỗi khổng lồ.
const MAX_USERNAME_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 256;

function parseCredentials(
  body: unknown,
): { username: string; password: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { username, password } = body as Record<string, unknown>;
  if (typeof username !== 'string' || typeof password !== 'string') return null;
  if (!username.trim() || !password) return null;
  if (
    username.trim().length > MAX_USERNAME_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  )
    return null;
  return { username, password };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    const credentials = parseCredentials(body);
    if (!credentials)
      throw new BadRequestException('Vui lòng nhập tên đăng nhập và mật khẩu.');
    const user = await authenticate(
      this.prisma,
      credentials.username,
      credentials.password,
    );
    if (!user) {
      log('warn', 'login_failed', {
        username: normalizeUsername(credentials.username),
      });
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu.');
    }
    const { token, expiresAt } = await createSession(this.prisma, user.id);
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
    log('info', 'login_succeeded', { userId: user.id });
    return user;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (token) await invalidateSession(this.prisma, token);
    res.clearCookie(SESSION_COOKIE, cookieOptions);
  }

  @Get('me')
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }
}
