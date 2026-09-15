import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import type { ApiErrorResponse } from '../types/api-response.type.js';
import type { RequestWithId } from '../types/request-with-id.type.js';

type HttpExceptionBody = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

type ResolvedError = {
  code: string;
  message: string;
  details: unknown[];
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger(GlobalExceptionFilter.name);
  }

  public catch(exception: unknown, host: ArgumentsHost): void {
    const request: RequestWithId = host.switchToHttp().getRequest<RequestWithId>();
    const response: Response = host.switchToHttp().getResponse<Response>();

    const statusCode: number = this.getStatusCode(exception);
    const resolvedError: ResolvedError = this.resolveError(exception, statusCode);

    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logUnexpectedException(exception);
    }

    const errorResponse: ApiErrorResponse = {
      statusCode: statusCode,
      code: resolvedError.code,
      message: resolvedError.message,
      details: resolvedError.details,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      requestId: request.id,
    };

    response.status(statusCode).json(errorResponse);
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveError(exception: unknown, statusCode: number): ResolvedError {
    if (!(exception instanceof HttpException)) {
      return {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        details: [],
      };
    }

    const exceptionResponse: string | object = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return {
        code: this.getDefaultErrorCode(statusCode),
        message: exceptionResponse,
        details: [],
      };
    }

    const exceptionBody: HttpExceptionBody = exceptionResponse;

    if (statusCode === HttpStatus.BAD_REQUEST && Array.isArray(exceptionBody.message)) {
      return {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: exceptionBody.message,
      };
    }

    let code: string = this.getDefaultErrorCode(statusCode);
    let message: string = exception.message;
    let details: unknown[] = [];

    if (typeof exceptionBody.code === 'string') {
      code = exceptionBody.code;
    }

    if (typeof exceptionBody.message === 'string') {
      message = exceptionBody.message;
    }

    if (Array.isArray(exceptionBody.details)) {
      details = exceptionBody.details;
    }

    return {
      code: code,
      message: message,
      details: details,
    };
  }

  private getDefaultErrorCode(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';

      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';

      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';

      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';

      case HttpStatus.CONFLICT:
        return 'CONFLICT';

      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';

      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_SERVER_ERROR';

      default:
        return 'HTTP_ERROR';
    }
  }

  private logUnexpectedException(exception: unknown): void {
    if (exception instanceof Error) {
      this.logger.error('Unhandled exception', exception.stack);

      return;
    }

    this.logger.error('Unhandled non-Error exception');
  }
}