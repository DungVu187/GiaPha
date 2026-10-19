import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { PasswordResetController } from './password-reset.controller.js';
import { SessionGuard } from './session.guard.js';

@Module({
  controllers: [AuthController, PasswordResetController],
  providers: [{ provide: APP_GUARD, useClass: SessionGuard }],
})
export class AuthModule {}
