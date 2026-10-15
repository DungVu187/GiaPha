import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AnniversariesController } from './anniversaries.controller.js';
import { CalendarController } from './calendar.controller.js';
import { MembersController } from './members.controller.js';
import { ServiceErrorFilter } from './service-error.filter.js';
import { TreeController } from './tree.controller.js';

@Module({
  controllers: [
    MembersController,
    CalendarController,
    TreeController,
    AnniversariesController,
  ],
  providers: [{ provide: APP_FILTER, useClass: ServiceErrorFilter }],
})
export class MembersModule {}
