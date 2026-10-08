
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request } from 'express';

import { authConfig } from '../../../config/namespaces/auth.config.js';
import { AuthErrorCode } from '../constants/auth-error-code.constant.js';

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly configuration: ConfigType<typeof authConfig>;

  constructor(
    @Inject(authConfig.KEY)
    configuration: ConfigType<typeof authConfig>,
  ) {
    this.configuration = configuration;
  }

  public canActivate(context: ExecutionContext): boolean {
    const request: Request =
      context.switchToHttp().getRequest<Request>();

    const origin: string | undefined = request.headers.origin;

    if (
      origin === undefined
      || !this.configuration.allowedOrigins.includes(origin)
    ) {
      throw new ForbiddenException({
        code: AuthErrorCode.AUTH_ORIGIN_NOT_ALLOWED,
        message: 'Origin not allowed.',
      });
    }

    return true;
  }
}
