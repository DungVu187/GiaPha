import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CalendarController } from './calendar.controller.js';
import { MembersController } from './members.controller.js';
import { ServiceErrorFilter } from './service-error.filter.js';

@Module({
  controllers: [MembersController, CalendarController],
  providers: [{ provide: APP_FILTER, useClass: ServiceErrorFilter }],
})
export class MembersModule {}
