import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { SessionUser } from '../auth/session.js';
import { todayInVietnam } from '../lib/anniversary.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseMemberInput, type MemberInput } from './member-input.js';
import {
  addRelative,
  createMember,
  deleteMember,
  getMemberDetail,
  INVALID,
  NOT_FOUND,
  removeSpouse,
  searchMembers,
  ServiceError,
  updateMember,
  type RelationKind,
} from './member-service.js';

const RELATIONS: readonly unknown[] = ['FATHER', 'MOTHER', 'SPOUSE', 'CHILD'];
// Giới hạn cột Int (32-bit) của Postgres.
const MAX_INT32 = 2147483647;
const BAD_TARGET = { target: 'Chọn người có sẵn hoặc nhập người mới.' };
const BAD_QUERY = { query: 'Tham số tìm kiếm không hợp lệ.' };

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
    await deleteMember(this.prisma, user, parseId(id));
    // Task 11: xóa file ảnh trả về từ deleteMember.
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
