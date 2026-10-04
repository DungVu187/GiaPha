import {
  type ArgumentsHost,
  BadRequestException,
  Body,
  Catch,
  Controller,
  Delete,
  type ExceptionFilter,
  Get,
  HttpCode,
  Param,
  PayloadTooLargeException,
  Post,
  Put,
  Query,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { SessionUser } from '../auth/session.js';
import { todayInVietnam } from '../lib/anniversary.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MAX_AVATAR_BYTES, removeAvatarFile } from './avatar.js';
import { parseMemberInput, type MemberInput } from './member-input.js';
import {
  addRelative,
  clearAvatar,
  createMember,
  deleteMember,
  getMemberDetail,
  INVALID,
  NOT_FOUND,
  removeSpouse,
  searchMembers,
  setAvatar,
  ServiceError,
  updateMember,
  type RelationKind,
} from './member-service.js';

const RELATIONS: readonly unknown[] = ['FATHER', 'MOTHER', 'SPOUSE', 'CHILD'];
// Giới hạn cột Int (32-bit) của Postgres.
const MAX_INT32 = 2147483647;
const BAD_TARGET = { target: 'Chọn người có sẵn hoặc nhập người mới.' };
const BAD_QUERY = { query: 'Tham số tìm kiếm không hợp lệ.' };
const NO_FILE = { file: 'Vui lòng chọn ảnh.' };

const isPositiveInt32 = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_INT32;

// Chuỗi số nguyên dương ≤ MAX_INT32 → số; còn lại → null.
function positiveIntOf(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d{1,10}$/.test(raw)) return null;
  const n = Number(raw);
  return isPositiveInt32(n) ? n : null;
}

export function parseId(raw: string): number {
  const id = positiveIntOf(raw);
  if (id === null) throw new ServiceError(404, NOT_FOUND);
  return id;
}

function parseInputOrThrow(body: unknown): MemberInput {
  const r = parseMemberInput(body, todayInVietnam());
  if (!r.ok) throw new ServiceError(400, INVALID, r.errors);
  return r.value;
}

// Tham số query tùy chọn: thiếu / rỗng → undefined; sai (kể cả dạng mảng ?x=a&x=b) → ném 400.
function optionalParam<T>(
  raw: unknown,
  parse: (v: unknown) => T | null,
): T | undefined {
  if (raw === undefined || raw === '') return undefined;
  const v = parse(raw);
  if (v === null) throw new ServiceError(400, INVALID, BAD_QUERY);
  return v;
}

// Lỗi multer trên route upload ảnh: quá cỡ → 413; multipart sai (sai tên trường, nhiều file…) → 400.
@Catch(PayloadTooLargeException, BadRequestException)
export class AvatarUploadErrorFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof PayloadTooLargeException)
      res.status(413).json({ message: 'Ảnh tối đa 5 MB.' });
    else res.status(400).json({ message: INVALID, errors: NO_FILE });
  }
}

@Controller('members')
export class MembersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  search(@Query() query: Record<string, unknown>) {
    return searchMembers(this.prisma, {
      q: optionalParam(query.q, (v) =>
        typeof v === 'string' && v.length <= 100 ? v : null,
      ),
      generation: optionalParam(query.generation, positiveIntOf),
      gender: optionalParam(query.gender, (v) =>
        v === 'MALE' || v === 'FEMALE' ? v : null,
      ),
      excludeId: optionalParam(query.excludeId, positiveIntOf),
      limit: optionalParam(query.limit, positiveIntOf),
    });
  }

  @Get(':id')
  detail(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return getMemberDetail(this.prisma, user, parseId(id), todayInVietnam());
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    return createMember(this.prisma, user, parseInputOrThrow(body));
  }

  @Put(':id')
  @HttpCode(204)
  async update(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const memberId = parseId(id);
    await updateMember(this.prisma, user, memberId, parseInputOrThrow(body));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
  ): Promise<void> {
    const { avatarPath } = await deleteMember(this.prisma, user, parseId(id));
    await removeAvatarFile(avatarPath);
  }

  // multer giữ file trong bộ nhớ (không ghi đĩa); service kiểm quyền rồi mới lưu.
  @Post(':id/avatar')
  @HttpCode(200)
  @UseFilters(AvatarUploadErrorFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    const memberId = parseId(id);
    if (!file) throw new ServiceError(400, INVALID, NO_FILE);
    return setAvatar(this.prisma, user, memberId, file.buffer);
  }

  @Delete(':id/avatar')
  @HttpCode(204)
  async deleteAvatar(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
  ): Promise<void> {
    await clearAvatar(this.prisma, user, parseId(id));
  }

  @Post(':id/relatives')
  relative(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const memberId = parseId(id);
    const raw = (
      typeof body === 'object' && body !== null && !Array.isArray(body)
        ? body
        : {}
    ) as Record<string, unknown>;
    if (!RELATIONS.includes(raw.relation)) {
      throw new ServiceError(400, INVALID, {
        relation: 'Loại quan hệ không hợp lệ.',
      });
    }
    const relation = raw.relation as RelationKind;
    const hasExisting = raw.existingId !== undefined && raw.existingId !== null;
    const hasMember = raw.member !== undefined && raw.member !== null;
    if (hasExisting === hasMember)
      throw new ServiceError(400, INVALID, BAD_TARGET);
    if (hasExisting) {
      if (!isPositiveInt32(raw.existingId))
        throw new ServiceError(400, INVALID, BAD_TARGET);
      return addRelative(this.prisma, user, memberId, relation, {
        existingId: raw.existingId,
      });
    }
    return addRelative(this.prisma, user, memberId, relation, {
      member: parseInputOrThrow(raw.member),
    });
  }

  @Delete(':id/spouses/:spouseId')
  @HttpCode(204)
  async unmarry(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Param('spouseId') spouseId: string,
  ): Promise<void> {
    await removeSpouse(this.prisma, user, parseId(id), parseId(spouseId));
  }
}
