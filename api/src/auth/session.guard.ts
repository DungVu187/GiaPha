import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { readCookie } from '../lib/cookie.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IS_PUBLIC } from './public.decorator.js';
import {
  SESSION_COOKIE,
  type SessionUser,
  validateSessionToken,
} from './session.js';

export type AuthedRequest = Request & { user?: SessionUser };

// Mặc định mọi route phải đăng nhập (spec D5); route công khai gắn @Public().
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    const user = token ? await validateSessionToken(this.prisma, token) : null;
    if (!user) throw new UnauthorizedException();
    req.user = user;
    return true;
  }
}
