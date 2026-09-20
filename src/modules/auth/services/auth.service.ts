import { randomUUID } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { authConfig } from '../../../config/namespaces/auth.config.js';
import type { AdminUser, RefreshTokenSession } from '../../../generated/prisma/client.js';
import { AuthErrorCode } from './../constants/auth-error-code.constant.js';
import type { LoginRequestDto } from './../dto/login-request.dto.js';
import { AuthAdminResponse } from './../models/auth-admin-response.model.js';
import { LoginResponse } from './../models/login-response.model.js';
import { AuthRepository } from './../repositories/auth.repository.js';
import { AccessTokenService } from './access-token.service.js';
import { PasswordHasherService } from './password-hasher.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { RefreshTokenRevokedReason } from '../../../generated/prisma/enums.js';
import { RefreshResponse } from './../models//refresh-response.model.js';
import type { RefreshTokenSessionWithAdmin } from './../repositories/auth.repository.js';

export type LoginResult = {

  response: LoginResponse;

  refreshToken: string;

  refreshTokenExpiresAt: Date;

};

export type RefreshResult = {

  response: RefreshResponse;

  refreshToken: string;

  refreshTokenExpiresAt: Date;

};



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

  async login(request: LoginRequestDto): Promise<LoginResult> {

    const username: string = request.username.trim().toLowerCase();

    const adminUser: AdminUser | null = await this.authRepository.findAdminByUsername(username);

    if (adminUser === null) {

      throw this.createInvalidCredentialsException();

    }

    const isPasswordValid: boolean = await this.passwordHasherService.verifyPassword(
      adminUser.passwordHash,
      request.password,
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

    const refreshTokenSession: RefreshTokenSession = await this.authRepository.createLoginSession({
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

    const adminResponse: AuthAdminResponse = {

      id: adminUser.id,

      username: adminUser.username,

      role: adminUser.role,

      mustChangePassword: adminUser.mustChangePassword,

    };

    const response: LoginResponse = {

      accessToken: accessToken,

      expiresIn: this.configuration.accessTokenTtlSeconds,

      admin: adminResponse,

    };

    const result: LoginResult = {

      response: response,

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

    const currentSession: RefreshTokenSessionWithAdmin | null =
        await this.authRepository.findSessionWithAdminById(session.id);

    if (currentSession === null) {

        throw this.createUnauthorizedException();

    }

    if (!currentSession.adminUser.isActive) {

        throw this.createUnauthorizedException();

    }

    const rotatedAt: Date = new Date();

    if (
        currentSession.revokedReason === RefreshTokenRevokedReason.ROTATED
        || currentSession.replacedById !== null
    ) {

        await this.handleRefreshTokenReuse(
        currentSession.adminUserId,
        currentSession.familyId,
        rotatedAt,
        );

    }

    if (currentSession.revokedAt !== null) {

        throw this.createUnauthorizedException();

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

    const newSession: RefreshTokenSession | null =
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

        const latestSession: RefreshTokenSessionWithAdmin | null =
        await this.authRepository.findSessionWithAdminById(currentSession.id);

        if (
        latestSession !== null
        && (
            latestSession.revokedReason === RefreshTokenRevokedReason.ROTATED
            || latestSession.replacedById !== null
        )
        ) {

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

    const response: RefreshResponse = {

        accessToken: accessToken,

        expiresIn: this.configuration.accessTokenTtlSeconds,

    };

    const result: RefreshResult = {

        response: response,

        refreshToken: newRefreshToken,

        refreshTokenExpiresAt: newExpiresAt,

    };

    return result;

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