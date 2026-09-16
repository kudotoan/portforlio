import { INestApplication } from '@nestjs/common';

import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter.js';
import { SuccessResponseInterceptor } from '../../common/interceptors/success-response.interceptor.js';

export function setupResponse(application: INestApplication): void {
  application.useGlobalInterceptors(new SuccessResponseInterceptor());
  application.useGlobalFilters(new GlobalExceptionFilter());
}