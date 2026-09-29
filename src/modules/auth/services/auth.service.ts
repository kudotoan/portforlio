import { randomUUID } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { authConfig } from '../../../config/namespaces/auth.config.js';
import { RefreshTokenRevokedReason } from '../../../generated/prisma/enums.js';
import { AuthErrorCode } from '../constants/auth-error-code.constant.js';
import type { AuthAdminUser } from '../models/admin-user.model.js';
import type { AuthRefreshSession, AuthRefreshSessionWithAdmin } from '../models/refresh-session.model.js';
import { AuthRepository } from '../repositories/auth.repository.js';
import type { AuthAdminResult, LoginInput, LoginResult, RefreshResult } from '../types/auth-service.type.js';
import { AccessTokenService } from './access-token.service.js';
import { PasswordHasherService } from './password-hasher.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
@Injectable()
export class AuthService {

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly passwordHasherService: PasswordHasherService,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    @Inject(authConfig.KEY) private readonly configuration: ConfigType<typeof authConfig>,
  ) {

  }

  async login(input: LoginInput): Promise<LoginResult> {

    const username: string = input.username.trim().toLowerCase();

    const adminUser: AuthAdminUser | null = await this.authRepository.findAdminByUsername(username);

    if (adminUser === null) {

      throw this.createInvalidCredentialsException();

    }

    const isPasswordValid: boolean = await this.passwordHasherService.verifyPassword(
      adminUser.passwordHash,
      input.password,
    );

    if (!isPasswordValid) {

      throw this.createInvalidCredentialsException();

    }

    if (!adminUser.isActive) {

      throw this.createInvalidCredentialsException();

    }

    const refreshToken: string = this.refreshTokenService.generateRefreshToken();

    const tokenHash: string = this.refreshTokenService.hashRefreshToken(refreshToken);

    const now: Date = new Date();

    const familyId: string = randomUUID();

    const familyExpiresAt: Date = new Date(
      now.getTime() + this.configuration.refreshFamilyTtlSeconds * 1000,
    );

    const idleExpiresAt: Date = new Date(
      now.getTime() + this.configuration.refreshIdleTtlSeconds * 1000,
    );

    let expiresAt: Date = idleExpiresAt;

    if (familyExpiresAt.getTime() < idleExpiresAt.getTime()) {

      expiresAt = familyExpiresAt;

    }

    const refreshTokenSession: AuthRefreshSession = await this.authRepository.createLoginSession({
      adminUserId: adminUser.id,
      tokenHash: tokenHash,
      familyId: familyId,
      expiresAt: expiresAt,
      familyExpiresAt: familyExpiresAt,
    });

    const accessToken: string = await this.accessTokenService.signAccessToken(
      adminUser.id,
      refreshTokenSession.id,
    );

    const admin: AuthAdminResult = {

      id: adminUser.id,

      username: adminUser.username,

      role: adminUser.role,

      mustChangePassword: adminUser.mustChangePassword,

    };

    const result: LoginResult = {

      accessToken: accessToken,

      expiresIn: this.configuration.accessTokenTtlSeconds,

      admin: admin,

      refreshToken: refreshToken,

      refreshTokenExpiresAt: expiresAt,

    };

    return result;

  }

  async refresh(refreshToken: string): Promise<RefreshResult> {

    const tokenHash: string = this.refreshTokenService.hashRefreshToken(refreshToken);

    const session = await this.authRepository.findSessionByTokenHash(tokenHash);

    if (session === null) {

        throw this.createUnauthorizedException();

    }

    const currentSession: AuthRefreshSessionWithAdmin | null =
        await this.authRepository.findSessionWithAdminById(session.id);

    if (currentSession === null) {

        throw this.createUnauthorizedException();

    }

    if (!currentSession.adminUser.isActive) {

        throw this.createUnauthorizedException();

    }

    const rotatedAt: Date = new Date();

    if (this.isRefreshSessionRevoked(currentSession)) {

        await this.handleRefreshTokenReuse(
        currentSession.adminUserId,
        currentSession.familyId,
        rotatedAt,
        );

    }

    if (
        currentSession.expiresAt.getTime() <= rotatedAt.getTime()
        || currentSession.familyExpiresAt.getTime() <= rotatedAt.getTime()
    ) {

        throw this.createSessionExpiredException();

    }

    const newRefreshToken: string = this.refreshTokenService.generateRefreshToken();

    const newTokenHash: string = this.refreshTokenService.hashRefreshToken(newRefreshToken);

    const idleExpiresAt: Date = new Date(
        rotatedAt.getTime() + this.configuration.refreshIdleTtlSeconds * 1000,
    );

    let newExpiresAt: Date = idleExpiresAt;

    if (currentSession.familyExpiresAt.getTime() < idleExpiresAt.getTime()) {

        newExpiresAt = currentSession.familyExpiresAt;

    }

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

        const latestSession: AuthRefreshSessionWithAdmin | null =
        await this.authRepository.findSessionWithAdminById(currentSession.id);

        if (latestSession !== null && this.isRefreshSessionRevoked(latestSession)) {

        await this.handleRefreshTokenReuse(
            currentSession.adminUserId,
            currentSession.familyId,
            new Date(),
        );

        }

        if (
        latestSession !== null
        && (
            latestSession.expiresAt.getTime() <= Date.now()
            || latestSession.familyExpiresAt.getTime() <= Date.now()
        )
        ) {

        throw this.createSessionExpiredException();

        }

        throw this.createUnauthorizedException();

    }

    const accessToken: string = await this.accessTokenService.signAccessToken(
        currentSession.adminUserId,
        newSession.id,
    );

    const result: RefreshResult = {

        accessToken: accessToken,

        expiresIn: this.configuration.accessTokenTtlSeconds,

        refreshToken: newRefreshToken,

        refreshTokenExpiresAt: newExpiresAt,

    };

    return result;

    }

    

  private isRefreshSessionRevoked(session: AuthRefreshSession): boolean {

    return session.revokedAt !== null
      || session.revokedReason !== null
      || session.replacedById !== null;

  }

  private createInvalidCredentialsException(): UnauthorizedException {

    return new UnauthorizedException({
      code: AuthErrorCode.AUTH_INVALID_CREDENTIALS,
      message: 'Invalid credentials.',
    });

  }

  private async handleRefreshTokenReuse(
    adminUserId: string,
    familyId: string,
    detectedAt: Date,
    ): Promise<never> {

    await this.authRepository.revokeFamily({
        adminUserId: adminUserId,
        familyId: familyId,
        revokedAt: detectedAt,
        revokedReason: RefreshTokenRevokedReason.REUSE_DETECTED,
    });

    throw new UnauthorizedException({
        code: AuthErrorCode.AUTH_REFRESH_TOKEN_REUSED,
        message: 'Refresh token reuse detected.',
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