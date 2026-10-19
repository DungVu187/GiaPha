import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { log } from '../lib/logger.js';
import { mailerFromEnv } from '../mail/mailer.js';
import { INVALID, ServiceError } from '../members/member-service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  checkResetToken,
  confirmPasswordReset,
  requestPasswordReset,
} from './password-reset.js';
import { Public } from './public.decorator.js';

const DISABLED = 'Chức năng quên mật khẩu chưa được bật.';
const NOT_FOUND = 'Không tìm thấy tài khoản với tên đăng nhập hoặc email này.';
const COOLDOWN = 'Vừa gửi link xong. Vui lòng đợi 1 phút rồi gửi lại.';
const INVALID_LINK = 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';

const field = (body: unknown, key: string): unknown =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)[key]
    : undefined;

// Công khai (spec D10); SessionGuard đọc @Public() ở cả handler lẫn class. Token chỉ đi trong body, không nằm
// trong URL của API (tránh lọt vào log truy cập).
@Public()
@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('enabled')
  enabled() {
    return { enabled: mailerFromEnv() !== null };
  }

  @Post()
  @HttpCode(200)
  async request(@Body() body: unknown) {
    const mailer = mailerFromEnv();
    if (!mailer) throw new ServiceError(404, DISABLED);
    const identifier = field(body, 'identifier');
    if (typeof identifier !== 'string' || !identifier.trim())
      throw new ServiceError(400, INVALID, {
        identifier: 'Vui lòng nhập tên đăng nhập hoặc email.',
      });
    const r = await requestPasswordReset(
      this.prisma,
      identifier,
      mailer,
      process.env.APP_URL!,
    );
    switch (r.kind) {
      case 'not-found':
        throw new ServiceError(404, NOT_FOUND);
      case 'cooldown':
        throw new ServiceError(429, COOLDOWN);
      case 'no-email':
        return { status: 'no-email', username: r.username };
      case 'sent':
        log('info', 'password_reset_requested', { userId: r.userId });
        return { status: 'sent', maskedEmail: r.maskedEmail };
    }
  }

  @Post('check')
  @HttpCode(200)
  async check(@Body() body: unknown) {
    const r = await checkResetToken(this.prisma, field(body, 'token'));
    if (!r) throw new ServiceError(404, INVALID_LINK);
    return r;
  }

  @Post('confirm')
  @HttpCode(204)
  async confirm(@Body() body: unknown): Promise<void> {
    const r = await confirmPasswordReset(
      this.prisma,
      field(body, 'token'),
      field(body, 'newPassword'),
    );
    if (!r.ok && r.error === 'password')
      throw new ServiceError(400, INVALID, { newPassword: r.message });
    if (!r.ok) throw new ServiceError(404, INVALID_LINK);
    log('info', 'password_reset_completed', { userId: r.userId });
  }
}
