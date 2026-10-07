import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthErrorCode } from '../constants/auth-error-code.constant.js';
import type { AuthAccessSession } from '../models/access-session.model.js';
import type { CurrentAdmin } from '../models/current-admin.model.js';
import { AuthRepository } from '../repositories/auth.repository.js';
import { AccessTokenService } from '../services/access-token.service.js';
import type { AccessTokenPayload } from '../types/access-token-payload.type.js';
import type { AuthenticatedRequest } from '../types/authenticated-request.type.js';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly authRepository: AuthRepository;
  private readonly accessTokenService: AccessTokenService;

  constructor(
    authRepository: AuthRepository,
    accessTokenService: AccessTokenService,
  ) {
    this.authRepository = authRepository;
    this.accessTokenService = accessTokenService;
  }

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request =
      context.switchToHttp().getRequest<Request>();

    const accessToken: string = this.getBearerToken(request);

    const payload: AccessTokenPayload =
      await this.verifyAccessToken(accessToken);

    const session: AuthAccessSession | null =
      await this.authRepository.findAccessSessionById(payload.sid);

    if (session === null) {
      throw this.createUnauthorizedException();
    }

    this.validateSessionIdentity(session, payload);

    this.validateSessionState(session, new Date());

    if (!session.adminUser.isActive) {
      throw this.createUnauthorizedException();
    }

    const currentAdmin: CurrentAdmin = {
      id: session.adminUser.id,
      username: session.adminUser.username,
      role: session.adminUser.role,
      mustChangePassword: session.adminUser.mustChangePassword,
    };

    const authenticatedRequest: AuthenticatedRequest =
      request as AuthenticatedRequest;

    authenticatedRequest.currentAdmin = currentAdmin;

    return true;
  }

  private getBearerToken(request: Request): string {
    const authorizationHeader: string | undefined =
      request.headers.authorization;

    if (typeof authorizationHeader !== 'string') {
      throw this.createUnauthorizedException();
    }

    const parts: string[] =
      authorizationHeader.trim().split(/\s+/);

    const scheme: string | undefined = parts[0];
    const accessToken: string | undefined = parts[1];

    if (
      parts.length !== 2
      || scheme?.toLowerCase() !== 'bearer'
      || accessToken === undefined
      || accessToken.length === 0
    ) {
      throw this.createUnauthorizedException();
    }

    return accessToken;
  }

  private async verifyAccessToken(
    accessToken: string,
  ): Promise<AccessTokenPayload> {
    try {
      return await this.accessTokenService.verifyAccessToken(accessToken);
    } catch {
      throw this.createUnauthorizedException();
    }
  }

  private validateSessionIdentity(
    session: AuthAccessSession,
    payload: AccessTokenPayload,
  ): void {
    if (
      session.adminUserId !== payload.sub
      || session.adminUser.id !== payload.sub
    ) {
      throw this.createUnauthorizedException();
    }
  }

  private validateSessionState(
    session: AuthAccessSession,
    checkedAt: Date,
  ): void {
    if (
      session.revokedAt !== null
      || session.revokedReason !== null
      || session.replacedById !== null
    ) {
      throw this.createUnauthorizedException();
    }

    if (
      session.expiresAt.getTime() <= checkedAt.getTime()
      || session.familyExpiresAt.getTime() <= checkedAt.getTime()
    ) {
      throw this.createSessionExpiredException();
    }
  }

  private createUnauthorizedException(): UnauthorizedException {
    return new UnauthorizedException({
      code: AuthErrorCode.AUTH_UNAUTHORIZED,
      message: 'Unauthorized.',
    });
  }

  private createSessionExpiredException(): UnauthorizedException {
    return new UnauthorizedException({
      code: AuthErrorCode.AUTH_SESSION_EXPIRED,
      message: 'Session expired.',
    });
  }
}