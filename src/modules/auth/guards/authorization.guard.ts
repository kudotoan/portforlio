import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AdminRole } from '../../../generated/prisma/enums.js';
import { AuthErrorCode } from '../constants/auth-error-code.constant.js';
import {
  REQUIRED_ROLES_KEY,
} from '../decorators/require-roles.decorator.js';
import type { AuthenticatedRequest } from '../types/authenticated-request.type.js';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  public canActivate(
    context: ExecutionContext,
  ): boolean {
    const requiredRoles: AdminRole[] | undefined =
      this.reflector.getAllAndOverride<AdminRole[]>(
        REQUIRED_ROLES_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (
      requiredRoles === undefined
      || requiredRoles.length === 0
    ) {
      return true;
    }

    const request: AuthenticatedRequest =
      context.switchToHttp()
        .getRequest<AuthenticatedRequest>();

    const currentAdmin = request.currentAdmin;

    if (currentAdmin === undefined) {
      throw this.createUnauthorizedException();
    }

    if (!requiredRoles.includes(currentAdmin.role)) {
      throw this.createForbiddenException();
    }

    return true;
  }

  private createUnauthorizedException(): UnauthorizedException {
    return new UnauthorizedException({
      code: AuthErrorCode.AUTH_UNAUTHORIZED,
      message: 'Unauthorized.',
    });
  }

  private createForbiddenException(): ForbiddenException {
    return new ForbiddenException({
      code: AuthErrorCode.AUTH_FORBIDDEN,
      message: 'Forbidden.',
    });
  }
}