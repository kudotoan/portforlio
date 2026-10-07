import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthErrorCode } from '../constants/auth-error-code.constant.js';
import type { AuthenticatedRequest } from '../types/authenticated-request.type.js';

@Injectable()
export class PasswordChangeGuard implements CanActivate {
  public canActivate(
    context: ExecutionContext,
  ): boolean {
    const request =
      context.switchToHttp().getRequest<
        Partial<AuthenticatedRequest>
      >();

    const currentAdmin = request.currentAdmin;

    if (currentAdmin === undefined) {
      throw this.createUnauthorizedException();
    }

    if (currentAdmin.mustChangePassword) {
      throw this.createPasswordChangeRequiredException();
    }

    return true;
  }

  private createUnauthorizedException(): UnauthorizedException {
    return new UnauthorizedException({
      code: AuthErrorCode.AUTH_UNAUTHORIZED,
      message: 'Unauthorized.',
    });
  }

  private createPasswordChangeRequiredException(): ForbiddenException {
    return new ForbiddenException({
      code: AuthErrorCode.AUTH_PASSWORD_CHANGE_REQUIRED,
      message: 'Password change required.',
    });
  }
}