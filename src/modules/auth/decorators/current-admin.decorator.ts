import {
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';

import type { CurrentAdmin as CurrentAdminModel } from '../models/current-admin.model.js';
import type { AuthenticatedRequest } from '../types/authenticated-request.type.js';

export const CurrentAdmin = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): CurrentAdminModel => {
    const request: AuthenticatedRequest =
      context.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.currentAdmin;
  },
);