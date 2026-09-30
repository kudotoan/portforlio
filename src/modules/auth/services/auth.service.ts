import { randomUUID } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { authConfig } from '../../../config/namespaces/auth.config.js';
import { RefreshTokenRevokedReason } from '../../../generated/prisma/enums.js';
import { AuthErrorCode } from '../constants/auth-error-code.constant.js';
import type { AuthAdminUser } from '../models/admin-user.model.js';
import type { AuthRefreshSession } from '../models/refresh-session.model.js';
import type { AuthRefreshSessionContext } from '../models/refresh-session-context.model.js';
import type { AuthRefreshSessionState } from '../models/refresh-session-state.model.js';
import { AuthRepository } from '../repositories/auth.repository.js';
import type {
  LoginInput,
  LoginResult,
  RefreshResult,
} from '../types/auth-service.type.js';
import { AccessTokenService } from './access-token.service.js';
import { PasswordHasherService } from './password-hasher.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Injectable()
export class AuthService {
  private readonly authRepository: AuthRepository;
  private readonly passwordHasherService: PasswordHasherService;
  private readonly accessTokenService: AccessTokenService;
  private readonly refreshTokenService: RefreshTokenService;
  private readonly configuration: ConfigType<typeof authConfig>;

  constructor(
    authRepository: AuthRepository,
    passwordHasherService: PasswordHasherService,
    accessTokenService: AccessTokenService,
    refreshTokenService: RefreshTokenService,
    @Inject(authConfig.KEY) configuration: ConfigType<typeof authConfig>,
  ) {
    this.authRepository = authRepository;
    this.passwordHasherService = passwordHasherService;
    this.accessTokenService = accessTokenService;
    this.refreshTokenService = refreshTokenService;
    this.configuration = configuration;
  }

  public async login(input: LoginInput): Promise<LoginResult> {
    const username: string = input.username.trim().toLowerCase();
    const adminUser: AuthAdminUser | null =
      await this.authRepository.findAdminByUsername(username);

    if (adminUser === null) {
      throw this.createInvalidCredentialsException();
    }

    const isPasswordValid: boolean =
      await this.passwordHasherService.verifyPassword(adminUser.passwordHash, input.password);

    if (!isPasswordValid) {
      throw this.createInvalidCredentialsException();
    }

    if (!adminUser.isActive) {
      throw this.createInvalidCredentialsException();
    }

    const now: Date = new Date();
    const familyExpiresAt: Date = new Date(now.getTime() + this.configuration.refreshFamilyTtlSeconds * 1000);
    const expiresAt: Date = this.calculateSessionExpiresAt(now, familyExpiresAt);
    const refreshToken: string =
      this.refreshTokenService.generateRefreshToken();
    const tokenHash: string =
      this.refreshTokenService.hashRefreshToken(refreshToken);
    const session: AuthRefreshSession =
      await this.authRepository.createLoginSession({
        adminUserId: adminUser.id,
        tokenHash: tokenHash,
        familyId: randomUUID(),
        expiresAt: expiresAt,
        familyExpiresAt: familyExpiresAt,
      });
    const accessToken: string = await this.accessTokenService.signAccessToken(adminUser.id, session.id);

    return {
      accessToken: accessToken,
      expiresIn: this.configuration.accessTokenTtlSeconds,
      admin: {
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
        mustChangePassword: adminUser.mustChangePassword,
      },
      refreshToken: refreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  public async refresh(refreshToken: string): Promise<RefreshResult> {
    const tokenHash: string =
      this.refreshTokenService.hashRefreshToken(refreshToken);
    const candidate: AuthRefreshSessionContext | null =
      await this.authRepository.findRefreshSessionByTokenHash(tokenHash);
    const rotatedAt: Date = new Date();
    const currentSession: AuthRefreshSessionContext =
      await this.validateRefreshSession(candidate, rotatedAt);

    const newRefreshToken: string =
      this.refreshTokenService.generateRefreshToken();
    const newTokenHash: string =
      this.refreshTokenService.hashRefreshToken(newRefreshToken);
    const newExpiresAt: Date = this.calculateSessionExpiresAt(rotatedAt, currentSession.familyExpiresAt);
    const newSession: AuthRefreshSession | null =
      await this.authRepository.rotateRefreshSession({
        sessionId: currentSession.id,
        adminUserId: currentSession.adminUserId,
        familyId: currentSession.familyId,
        familyExpiresAt: currentSession.familyExpiresAt,
        newTokenHash: newTokenHash,
        newExpiresAt: newExpiresAt,
        rotatedAt: rotatedAt,
      });

    if (newSession === null) {
      return this.rejectFailedRotation(currentSession);
    }

    const accessToken: string = await this.accessTokenService.signAccessToken(
      currentSession.adminUserId,
      newSession.id,
    );

    return {
      accessToken: accessToken,
      expiresIn: this.configuration.accessTokenTtlSeconds,
      refreshToken: newRefreshToken,
      refreshTokenExpiresAt: newExpiresAt,
    };
  }

  private calculateSessionExpiresAt(now: Date, familyExpiresAt: Date): Date {
    const idleExpiresAt: number =
      now.getTime() + this.configuration.refreshIdleTtlSeconds * 1000;

    return new Date(Math.min(idleExpiresAt, familyExpiresAt.getTime()));
  }

  private async validateRefreshSession(
    session: AuthRefreshSessionContext | null,
    checkedAt: Date,
  ): Promise<AuthRefreshSessionContext> {
    if (session === null) {
      throw this.createUnauthorizedException();
    }

    if (!session.adminUser.isActive) {
      throw this.createUnauthorizedException();
    }

    await this.validateRefreshSessionState(session, session, checkedAt);

    return session;
  }

  private async validateRefreshSessionState(
    state: AuthRefreshSessionState,
    context: AuthRefreshSessionContext,
    checkedAt: Date,
  ): Promise<void> {
    if (state.revokedAt !== null) {
      await this.rejectRefreshTokenReuse(context, checkedAt);
    }

    if (state.revokedReason !== null) {
      await this.rejectRefreshTokenReuse(context, checkedAt);
    }

    if (state.replacedById !== null) {
      await this.rejectRefreshTokenReuse(context, checkedAt);
    }

    if (state.expiresAt.getTime() <= checkedAt.getTime()) {
      throw this.createSessionExpiredException();
    }

    if (state.familyExpiresAt.getTime() <= checkedAt.getTime()) {
      throw this.createSessionExpiredException();
    }
  }

  private async rejectFailedRotation(context: AuthRefreshSessionContext): Promise<never> {
    // A failed claim can mean another request already rotated or revoked the session.
    const latestState: AuthRefreshSessionState | null =
      await this.authRepository.findRefreshSessionStateById(context.id);

    if (latestState === null) {
      throw this.createUnauthorizedException();
    }

    await this.validateRefreshSessionState(latestState, context, new Date());

    throw this.createUnauthorizedException();
  }

  private async rejectRefreshTokenReuse(session: AuthRefreshSessionContext, detectedAt: Date): Promise<never> {
    await this.authRepository.revokeFamily({
      adminUserId: session.adminUserId,
      familyId: session.familyId,
      revokedAt: detectedAt,
      revokedReason: RefreshTokenRevokedReason.REUSE_DETECTED,
    });

    throw new UnauthorizedException({
      code: AuthErrorCode.AUTH_REFRESH_TOKEN_REUSED,
      message: 'Refresh token reuse detected.',
    });
  }

  private createInvalidCredentialsException(): UnauthorizedException {
    return new UnauthorizedException({
      code: AuthErrorCode.AUTH_INVALID_CREDENTIALS,
      message: 'Invalid credentials.',
    });
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
