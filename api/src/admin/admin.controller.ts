import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { SessionUser } from '../auth/session.js';
import { log } from '../lib/logger.js';
import { ServiceError } from '../members/member-service.js';
import { parseId } from '../members/members.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  USER_NOT_FOUND,
  changeRole,
  listUsers,
  requireAdmin,
  resetUserPassword,
  unlinkMember,
} from './admin.js';

const field = (body: unknown, key: string): unknown =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)[key]
    : undefined;

// parseId báo "Không tìm thấy thành viên." — ở đây đổi sang thông điệp tài khoản.
function parseUserId(raw: string): number {
  try {
    return parseId(raw);
  } catch {
    throw new ServiceError(404, USER_NOT_FOUND);
  }
}

// Chỉ Admin (spec §5): đặt lại mật khẩu, gỡ liên kết, đổi quyền. Kiểm quyền trong service.
// requireAdmin trước parseUserId: người không phải Admin luôn 403, không dò được id hợp lệ hay không.
@Controller('admin/users')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    requireAdmin(user);
    return listUsers(this.prisma);
  }

  @Post(':id/password')
  @HttpCode(204)
  async resetPassword(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    requireAdmin(user);
    const userId = parseUserId(id);
    await resetUserPassword(
      this.prisma,
      user,
      userId,
      field(body, 'newPassword'),
    );
    log('info', 'admin_password_reset', { actorId: user.id, userId });
  }

  @Delete(':id/member')
  @HttpCode(204)
  async unlink(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
  ): Promise<void> {
    requireAdmin(user);
    const userId = parseUserId(id);
    const memberId = await unlinkMember(this.prisma, user, userId);
    log('info', 'admin_unlinked', { actorId: user.id, userId, memberId });
  }

  @Put(':id/role')
  @HttpCode(204)
  async role(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    requireAdmin(user);
    const userId = parseUserId(id);
    const role = field(body, 'role');
    await changeRole(this.prisma, user, userId, role);
    log('info', 'admin_role_changed', { actorId: user.id, userId, role });
  }
}
