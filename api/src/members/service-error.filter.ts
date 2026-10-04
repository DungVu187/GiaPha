import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { ServiceError } from './member-service.js';

@Catch(ServiceError)
export class ServiceErrorFilter implements ExceptionFilter {
  catch(error: ServiceError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    res
      .status(error.status)
      .json(
        error.errors
          ? { message: error.message, errors: error.errors }
          : { message: error.message },
      );
  }
}
