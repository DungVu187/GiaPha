import { Module } from '@nestjs/common';
import { AccountModule } from './account/account.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { MembersModule } from './members/members.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    MembersModule,
    AccountModule,
    AdminModule,
  ],
})
export class AppModule {}
