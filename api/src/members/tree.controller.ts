import { Controller, Get } from '@nestjs/common';
import type { TreeData } from '../lib/tree.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadTree } from './tree.js';

// Mọi tài khoản đã đăng nhập đều xem được (spec §5); guard toàn cục chặn người chưa đăng nhập.
@Controller('tree')
export class TreeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  tree(): Promise<TreeData> {
    return loadTree(this.prisma);
  }
}
