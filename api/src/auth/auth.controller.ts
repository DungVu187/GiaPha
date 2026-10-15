import {
  BadRequestException,
  Body,
  ConflictException,
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
import { INVALID } from '../members/member-service.js';
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
import { MAX_PASSWORD_LENGTH } from './password.js';
import { register as registerUser, type RegisterMatch } from './register.js';
import { parseRegisterInput } from './register-input.js';
import { normalizeUsername } from './username.js';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

const CLAIM_UNAVAILABLE =
  'Hồ sơ này vừa được người khác nhận hoặc không còn phù hợp. Vui lòng chọn lại.';

// Giới hạn độ dài để không phải băm argon2 chuỗi khổng lồ.
const MAX_USERNAME_LENGTH = 64;

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
  @Post('register')
  async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser | { matches: RegisterMatch[] }> {
    const parsed = parseRegisterInput(body);
    if (!parsed.ok)
      throw new BadRequestException({
        message: INVALID,
        errors: parsed.errors,
      });
    const result = await registerUser(this.prisma, parsed.value);
    switch (result.kind) {
      case 'invalid':
        throw new BadRequestException({
          message: INVALID,
          errors: result.errors,
        });
      case 'claim-unavailable':
        throw new ConflictException({
          message: CLAIM_UNAVAILABLE,
          matches: result.matches,
        });
      case 'matches':
        res.status(200);
        return { matches: result.matches };
      case 'created': {
        // Đăng ký khi đang đăng nhập tài khoản khác → bỏ phiên cũ.
        const oldToken = readCookie(req.headers.cookie, SESSION_COOKIE);
        if (oldToken) await invalidateSession(this.prisma, oldToken);
        const { token, expiresAt } = await createSession(
          this.prisma,
          result.user.id,
        );
        res.cookie(SESSION_COOKIE, token, {
          ...cookieOptions,
          expires: expiresAt,
        });
        log('info', 'register_succeeded', {
          userId: result.user.id,
          memberId: result.user.memberId,
          claimed: result.claimed,
        });
        res.status(201);
        return result.user;
      }
    }
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
  async me(
    @CurrentUser() user: SessionUser,
  ): Promise<
    SessionUser & { member: { fullName: string; generation: number } | null }
  > {
    const member =
      user.memberId === null
        ? null
        : await this.prisma.member.findUnique({
            where: { id: user.memberId },
            select: { fullName: true, generation: true },
          });
    return { ...user, member };
  }
}
