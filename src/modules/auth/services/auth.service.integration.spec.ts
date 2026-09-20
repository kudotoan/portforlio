import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ConfigurationModule } from '../../../config/config.module.js';
import { PrismaModule } from '../../../database/prisma.module.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AdminUser, RefreshTokenSession } from '../../../generated/prisma/client.js';
import { AdminRole, RefreshTokenRevokedReason } from '../../../generated/prisma/enums.js';
import { AuthModule } from '../auth.module.js';
import { AuthErrorCode } from '../constants/auth-error-code.constant.js';
import type { LoginResult, RefreshResult } from './auth.service.js';
import { AuthService } from './auth.service.js';
import { AccessTokenService } from './access-token.service.js';
import { PasswordHasherService } from './password-hasher.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import type { AccessTokenPayload } from '../types/access-token-payload.type.js';

describe('AuthService refresh integration', () => {

  let testingModule: TestingModule;

  let prisma: PrismaService;

  let authService: AuthService;

  let passwordHasherService: PasswordHasherService;

  let refreshTokenService: RefreshTokenService;

  let accessTokenService: AccessTokenService;

  let createdAdminUserIds: string[] = [];

  async function createAdminUser(password: string): Promise<AdminUser> {

    const passwordHash: string = await passwordHasherService.hashPassword(password);

    const adminUser: AdminUser = await prisma.adminUser.create({
      data: {
        username: `refresh-it-${randomUUID()}`,
        passwordHash: passwordHash,
        role: AdminRole.OWNER,
        isActive: true,
        mustChangePassword: false,
      },
    });

    createdAdminUserIds.push(adminUser.id);

    return adminUser;

  }

  async function loginAdmin(adminUser: AdminUser, password: string): Promise<LoginResult> {

    const loginResult: LoginResult = await authService.login({
      username: adminUser.username,
      password: password,
    });

    return loginResult;

  }

  async function findSessionByRefreshToken(refreshToken: string): Promise<RefreshTokenSession> {

    const tokenHash: string = refreshTokenService.hashRefreshToken(refreshToken);

    const session: RefreshTokenSession | null = await prisma.refreshTokenSession.findUnique({
      where: {
        tokenHash: tokenHash,
      },
    });

    if (session === null) {

      throw new Error('Expected refresh token session to exist.');

    }

    return session;

  }

  async function expectUnauthorizedCode(
    operation: Promise<unknown>,
    expectedCode: AuthErrorCode,
  ): Promise<void> {

    let caughtError: unknown;

    try {

      await operation;

    } catch (error: unknown) {

      caughtError = error;

    }

    expect(caughtError).toBeInstanceOf(UnauthorizedException);

    const unauthorizedException: UnauthorizedException = caughtError as UnauthorizedException;

    const response: string | object = unauthorizedException.getResponse();

    expect(response).toMatchObject({
      code: expectedCode,
    });

  }

  beforeAll(async () => {

    testingModule = await Test.createTestingModule({
      imports: [ConfigurationModule, PrismaModule, AuthModule],
    }).compile();

    await testingModule.init();

    prisma = testingModule.get(PrismaService);

    authService = testingModule.get(AuthService);

    passwordHasherService = testingModule.get(PasswordHasherService);

    refreshTokenService = testingModule.get(RefreshTokenService);

    accessTokenService = testingModule.get(AccessTokenService);

  });

  afterEach(async () => {

    if (createdAdminUserIds.length === 0) {

      return;

    }

    await prisma.adminUser.deleteMany({
      where: {
        id: {
          in: createdAdminUserIds,
        },
      },
    });

    createdAdminUserIds = [];

  });

  afterAll(async () => {

    await testingModule.close();

  });

  it('should rotate refresh token and create access token with new session id', async () => {

    const password: string = 'StrongPassword123!';

    const adminUser: AdminUser = await createAdminUser(password);

    const loginResult: LoginResult = await loginAdmin(adminUser, password);

    const oldSession: RefreshTokenSession = await findSessionByRefreshToken(loginResult.refreshToken);

    const refreshResult: RefreshResult = await authService.refresh(loginResult.refreshToken);

    const newSession: RefreshTokenSession = await findSessionByRefreshToken(refreshResult.refreshToken);

    const savedOldSession: RefreshTokenSession | null = await prisma.refreshTokenSession.findUnique({
      where: {
        id: oldSession.id,
      },
    });

    expect(refreshResult.refreshToken).not.toBe(loginResult.refreshToken);

    expect(newSession.id).not.toBe(oldSession.id);

    expect(newSession.adminUserId).toBe(oldSession.adminUserId);

    expect(newSession.familyId).toBe(oldSession.familyId);

    expect(newSession.familyExpiresAt.getTime()).toBe(oldSession.familyExpiresAt.getTime());

    expect(newSession.revokedAt).toBeNull();

    expect(newSession.revokedReason).toBeNull();

    expect(savedOldSession?.revokedReason).toBe(RefreshTokenRevokedReason.ROTATED);

    expect(savedOldSession?.replacedById).toBe(newSession.id);

    expect(savedOldSession?.lastUsedAt).not.toBeNull();

    const accessTokenPayload: AccessTokenPayload =
      await accessTokenService.verifyAccessToken(refreshResult.response.accessToken);

    expect(accessTokenPayload.sub).toBe(adminUser.id);

    expect(accessTokenPayload.sid).toBe(newSession.id);

  });

  it('should detect reuse of rotated refresh token', async () => {

    const password: string = 'StrongPassword123!';

    const adminUser: AdminUser = await createAdminUser(password);

    const loginResult: LoginResult = await loginAdmin(adminUser, password);

    await authService.refresh(loginResult.refreshToken);

    await expectUnauthorizedCode(
      authService.refresh(loginResult.refreshToken),
      AuthErrorCode.AUTH_REFRESH_TOKEN_REUSED,
    );

  });

  it('should revoke replacement session after old refresh token reuse', async () => {

    const password: string = 'StrongPassword123!';

    const adminUser: AdminUser = await createAdminUser(password);

    const loginResult: LoginResult = await loginAdmin(adminUser, password);

    const refreshResult: RefreshResult = await authService.refresh(loginResult.refreshToken);

    const replacementSession: RefreshTokenSession =
      await findSessionByRefreshToken(refreshResult.refreshToken);

    await expectUnauthorizedCode(
      authService.refresh(loginResult.refreshToken),
      AuthErrorCode.AUTH_REFRESH_TOKEN_REUSED,
    );

    const savedReplacementSession: RefreshTokenSession | null =
      await prisma.refreshTokenSession.findUnique({
        where: {
          id: replacementSession.id,
        },
      });

    expect(savedReplacementSession?.revokedAt).not.toBeNull();

    expect(savedReplacementSession?.revokedReason).toBe(
      RefreshTokenRevokedReason.REUSE_DETECTED,
    );

  });

  it('should reject replacement refresh token after family reuse detection', async () => {

    const password: string = 'StrongPassword123!';

    const adminUser: AdminUser = await createAdminUser(password);

    const loginResult: LoginResult = await loginAdmin(adminUser, password);

    const refreshResult: RefreshResult = await authService.refresh(loginResult.refreshToken);

    await expectUnauthorizedCode(
      authService.refresh(loginResult.refreshToken),
      AuthErrorCode.AUTH_REFRESH_TOKEN_REUSED,
    );

    await expectUnauthorizedCode(
      authService.refresh(refreshResult.refreshToken),
      AuthErrorCode.AUTH_UNAUTHORIZED,
    );

  });

  it('should reject refresh when idle session has expired', async () => {

    const password: string = 'StrongPassword123!';

    const adminUser: AdminUser = await createAdminUser(password);

    const loginResult: LoginResult = await loginAdmin(adminUser, password);

    const session: RefreshTokenSession = await findSessionByRefreshToken(loginResult.refreshToken);

    await prisma.refreshTokenSession.update({
      where: {
        id: session.id,
      },
      data: {
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await expectUnauthorizedCode(
      authService.refresh(loginResult.refreshToken),
      AuthErrorCode.AUTH_SESSION_EXPIRED,
    );

  });

  it('should reject refresh when absolute family lifetime has expired', async () => {

    const password: string = 'StrongPassword123!';

    const adminUser: AdminUser = await createAdminUser(password);

    const loginResult: LoginResult = await loginAdmin(adminUser, password);

    const session: RefreshTokenSession = await findSessionByRefreshToken(loginResult.refreshToken);

    await prisma.refreshTokenSession.update({
      where: {
        id: session.id,
      },
      data: {
        familyExpiresAt: new Date(Date.now() - 1000),
      },
    });

    await expectUnauthorizedCode(
      authService.refresh(loginResult.refreshToken),
      AuthErrorCode.AUTH_SESSION_EXPIRED,
    );

  });

  it('should limit replacement session expiry to family expiry', async () => {

    const password: string = 'StrongPassword123!';

    const adminUser: AdminUser = await createAdminUser(password);

    const loginResult: LoginResult = await loginAdmin(adminUser, password);

    const session: RefreshTokenSession = await findSessionByRefreshToken(loginResult.refreshToken);

    const familyExpiresAt: Date = new Date(Date.now() + 60 * 1000);

    await prisma.refreshTokenSession.update({
      where: {
        id: session.id,
      },
      data: {
        familyExpiresAt: familyExpiresAt,
      },
    });

    const refreshResult: RefreshResult = await authService.refresh(loginResult.refreshToken);

    const replacementSession: RefreshTokenSession =
      await findSessionByRefreshToken(refreshResult.refreshToken);

    expect(replacementSession.familyExpiresAt.getTime()).toBe(familyExpiresAt.getTime());

    expect(replacementSession.expiresAt.getTime()).toBe(familyExpiresAt.getTime());

    expect(refreshResult.refreshTokenExpiresAt.getTime()).toBe(familyExpiresAt.getTime());

  });

  it('should reject refresh when admin user is inactive', async () => {

    const password: string = 'StrongPassword123!';

    const adminUser: AdminUser = await createAdminUser(password);

    const loginResult: LoginResult = await loginAdmin(adminUser, password);

    await prisma.adminUser.update({
      where: {
        id: adminUser.id,
      },
      data: {
        isActive: false,
      },
    });

    await expectUnauthorizedCode(
      authService.refresh(loginResult.refreshToken),
      AuthErrorCode.AUTH_UNAUTHORIZED,
    );

  });

  it('should reject unknown refresh token', async () => {

    const unknownRefreshToken: string = refreshTokenService.generateRefreshToken();

    await expectUnauthorizedCode(
      authService.refresh(unknownRefreshToken),
      AuthErrorCode.AUTH_UNAUTHORIZED,
    );

  });

});