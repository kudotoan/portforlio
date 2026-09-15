import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';

import type { ApiSuccessResponse } from '../types/api-response.type.js';
import type { RequestWithId } from '../types/request-with-id.type.js';

@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor<unknown, unknown> {
  public intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    const request: RequestWithId = context.switchToHttp().getRequest<RequestWithId>();
    const response: Response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown): unknown => {
        if (response.statusCode === HttpStatus.NO_CONTENT) {
          return data;
        }

        const apiResponse: ApiSuccessResponse<unknown> = {
          success: true,
          statusCode: response.statusCode,
          message: 'Request successful',
          data: data,
          timestamp: new Date().toISOString(),
          path: request.path,
          requestId: request.id,
        };

        return apiResponse;
      }),
    );
  }
}