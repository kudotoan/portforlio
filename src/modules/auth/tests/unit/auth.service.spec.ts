import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { authConfig } from '../../../../config/namespaces/auth.config.js';
import {
  AdminRole,
  RefreshTokenRevokedReason,
} from '../../../../generated/prisma/enums.js';
import { AuthErrorCode } from '../../constants/auth-error-code.constant.js';
import type { AuthAdminUser } from '../../models/admin-user.model.js';
import type { AuthRefreshSessionContext } from '../../models/refresh-session-context.model.js';
import type { AuthRefreshSession } from '../../models/refresh-session.model.js';
import type { AuthRefreshSessionState } from '../../models/refresh-session-state.model.js';
import type { LoginResult, RefreshResult } from '../../types/auth-service.type.js';
import { AuthRepository } from '../../repositories/auth.repository.js';
import { AccessTokenService } from '../../services/access-token.service.js';
import { AuthService } from '../../services/auth.service.js';
import { PasswordHasherService } from '../../services/password-hasher.service.js';
import { RefreshTokenService } from '../../services/refresh-token.service.js';

type RepositoryMock = {
  findAdminByUsername: Mock<AuthRepository['findAdminByUsername']>;
  createLoginSession: Mock<AuthRepository['createLoginSession']>;
  findRefreshSessionByTokenHash: Mock<AuthRepository['findRefreshSessionByTokenHash']>;
  findRefreshSessionStateById: Mock<AuthRepository['findRefreshSessionStateById']>;
  rotateRefreshSession: Mock<AuthRepository['rotateRefreshSession']>;
  revokeFamily: Mock<AuthRepository['revokeFamily']>;
};

type PasswordHasherMock = {
  verifyPassword: Mock<PasswordHasherService['verifyPassword']>;
};

type AccessTokenMock = {
  signAccessToken: Mock<AccessTokenService['signAccessToken']>;
};

type ServiceFixture = {
  service: AuthService;
  repository: RepositoryMock;
  admin: AuthAdminUser;
  passwordHasher: PasswordHasherMock;
  accessToken: AccessTokenMock;
  refreshToken: RefreshTokenService;
  configuration: ConfigType<typeof authConfig>;
};

const NOW: Date = new Date('2026-09-30T00:00:00.000Z');
const DAY: number = 24 * 60 * 60 * 1000;

function createSession(reason: RefreshTokenRevokedReason | null = null): AuthRefreshSessionContext {
  let revokedAt: Date | null = null;
  if (reason !== null) {
    revokedAt = NOW;
  }

  return {
    id: 'session-id',
    adminUserId: 'admin-id',
    familyId: 'family-id',
    familyExpiresAt: new Date(NOW.getTime() + 90 * DAY),
    expiresAt: new Date(NOW.getTime() + 7 * DAY),
    revokedAt: revokedAt,
    revokedReason: reason,
    replacedById: null,
    adminUser: { isActive: true },
  };
}

function createFullSession(id: string): AuthRefreshSession {
  return {
    id: id,
    adminUserId: 'admin-id',
    tokenHash: 'stored-token-hash',
    familyId: 'family-id',
    familyExpiresAt: new Date(NOW.getTime() + 90 * DAY),
    expiresAt: new Date(NOW.getTime() + 7 * DAY),
    revokedAt: null,
    revokedReason: null,
    replacedById: null,
    lastUsedAt: null,
    createdAt: NOW,
  };
}

function createSessionState(session: AuthRefreshSessionContext): AuthRefreshSessionState {
  return {
    expiresAt: session.expiresAt,
    familyExpiresAt: session.familyExpiresAt,
    revokedAt: session.revokedAt,
    revokedReason: session.revokedReason,
    replacedById: session.replacedById,
  };
}

async function createService(
  currentSession: AuthRefreshSessionContext | null = createSession(),
): Promise<ServiceFixture> {
  const admin: AuthAdminUser = {
    id: 'admin-id',
    username: 'owner',
    passwordHash: 'password-hash',
    role: AdminRole.OWNER,
    isActive: true,
    mustChangePassword: true,
  };
  const repository: RepositoryMock = {
    findAdminByUsername: vi
      .fn<AuthRepository['findAdminByUsername']>()
      .mockResolvedValue(admin),
    createLoginSession: vi
      .fn<AuthRepository['createLoginSession']>()
      .mockResolvedValue(createFullSession('login-session')),
    findRefreshSessionByTokenHash: vi
      .fn<AuthRepository['findRefreshSessionByTokenHash']>()
      .mockResolvedValue(currentSession),
    findRefreshSessionStateById: vi
      .fn<AuthRepository['findRefreshSessionStateById']>()
      .mockResolvedValue(null),
    rotateRefreshSession: vi
      .fn<AuthRepository['rotateRefreshSession']>()
      .mockResolvedValue(createFullSession('new-session')),
    revokeFamily: vi.fn<AuthRepository['revokeFamily']>().mockResolvedValue(1),
  };
  const passwordHasher: PasswordHasherMock = { verifyPassword: vi.fn().mockResolvedValue(true) };
  const accessToken: AccessTokenMock = {
    signAccessToken: vi.fn().mockResolvedValue('new-access-token'),
  };
  const refreshToken: RefreshTokenService = new RefreshTokenService();
  const configuration: ConfigType<typeof authConfig> = {
    accessTokenPrivateKeyPath: '',
    accessTokenPublicKeyPath: '',
    accessTokenIssuer: 'test',
    accessTokenAudience: 'test',
    refreshCookieName: 'refresh_token',
    refreshCookiePath: '/admin/auth',
    refreshCookieSecure: false,
    refreshCookieSameSite: 'strict',
    allowedOrigins: [],
    accessTokenTtlSeconds: 900,
    refreshIdleTtlSeconds: (7 * DAY) / 1000,
    refreshFamilyTtlSeconds: (90 * DAY) / 1000,
  };
  const testingModule: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: AuthRepository, useValue: repository },
      { provide: PasswordHasherService, useValue: passwordHasher },
      { provide: AccessTokenService, useValue: accessToken },
      { provide: RefreshTokenService, useValue: refreshToken },
      { provide: authConfig.KEY, useValue: configuration },
    ],
  }).compile();
  const service: AuthService = testingModule.get(AuthService);

  return {
    service: service,
    repository: repository,
    admin: admin,
    passwordHasher: passwordHasher,
    accessToken: accessToken,
    refreshToken: refreshToken,
    configuration: configuration,
  };
}

async function expectErrorCode(operation: Promise<unknown>, code: AuthErrorCode): Promise<void> {
  let caughtError: unknown;
  try {
    await operation;
  } catch (error: unknown) {
    caughtError = error;
  }
  expect(caughtError).toBeInstanceOf(UnauthorizedException);
  if (!(caughtError instanceof UnauthorizedException)) {
    throw new Error('Expected UnauthorizedException.');
  }
  expect(caughtError.getResponse()).toMatchObject({
    code: code,
  });
}

beforeEach((): void => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach((): void => {
  vi.useRealTimers();
});

describe('AuthService login', (): void => {
  it('chuan hoa username, giu password va chi luu hash refresh token', async (): Promise<void> => {
    const { service, repository, passwordHasher, accessToken, refreshToken }: ServiceFixture = await createService();
    const result: LoginResult = await service.login({
      username: '  OWNER  ',
      password: '  password  ',
    });

    expect(repository.findAdminByUsername).toHaveBeenCalledWith('owner');
    expect(passwordHasher.verifyPassword).toHaveBeenCalledWith('password-hash', '  password  ');
    expect(repository.createLoginSession).toHaveBeenCalledWith({
      adminUserId: 'admin-id',
      tokenHash: refreshToken.hashRefreshToken(result.refreshToken),
      familyId: expect.any(String),
      expiresAt: new Date(NOW.getTime() + 7 * DAY),
      familyExpiresAt: new Date(NOW.getTime() + 90 * DAY),
    });
    expect(accessToken.signAccessToken).toHaveBeenCalledWith('admin-id', 'login-session');
    expect(result.admin).toEqual({
      id: 'admin-id',
      username: 'owner',
      role: AdminRole.OWNER,
      mustChangePassword: true,
    });
    expect(result.expiresIn).toBe(900);
  });

  it('gioi han thoi han login theo family TTL', async (): Promise<void> => {
    const { service, configuration }: ServiceFixture = await createService();
    configuration.refreshFamilyTtlSeconds = 60;
    const result: LoginResult = await service.login({
      username: 'owner',
      password: 'password',
    });
    expect(result.refreshTokenExpiresAt).toEqual(new Date(NOW.getTime() + 60_000));
  });

  it.each(['missing', 'wrong-password', 'inactive'] as const)(
    'tu choi login %s truoc khi tao session',
    async (reason: 'missing' | 'wrong-password' | 'inactive'): Promise<void> => {
      const { service, repository, passwordHasher, admin }: ServiceFixture = await createService();
      if (reason === 'missing') {
        repository.findAdminByUsername.mockResolvedValue(null);
      }
      if (reason === 'wrong-password') {
        passwordHasher.verifyPassword.mockResolvedValue(false);
      }
      if (reason === 'inactive') {
        admin.isActive = false;
      }
      await expectErrorCode(
        service.login({ username: 'owner', password: 'password' }),
        AuthErrorCode.AUTH_INVALID_CREDENTIALS,
      );
      expect(repository.createLoginSession).not.toHaveBeenCalled();
    },
  );
});

describe('AuthService refresh', (): void => {
  it.each([60_000, 90 * DAY])(
    'doc mot lan va rotate voi family con %i ms',
    async (remaining: number): Promise<void> => {
      const session: AuthRefreshSessionContext = createSession();
      session.familyExpiresAt = new Date(NOW.getTime() + remaining);
      const { service, repository, accessToken, refreshToken }: ServiceFixture = await createService(session);
      const result: RefreshResult = await service.refresh('old-refresh-token');

      expect(repository.findRefreshSessionByTokenHash).toHaveBeenCalledExactlyOnceWith(
        refreshToken.hashRefreshToken('old-refresh-token'),
      );
      expect(repository.findRefreshSessionStateById).not.toHaveBeenCalled();
      expect(repository.rotateRefreshSession).toHaveBeenCalledWith({
        sessionId: session.id,
        adminUserId: session.adminUserId,
        familyId: session.familyId,
        familyExpiresAt: session.familyExpiresAt,
        newTokenHash: refreshToken.hashRefreshToken(result.refreshToken),
        newExpiresAt: new Date(NOW.getTime() + Math.min(7 * DAY, remaining)),
        rotatedAt: NOW,
      });
      expect(accessToken.signAccessToken).toHaveBeenCalledWith('admin-id', 'new-session');
      expect(result.refreshTokenExpiresAt).toEqual(new Date(NOW.getTime() + Math.min(7 * DAY, remaining)));
      expect(result.accessToken).toBe('new-access-token');
      expect(result.expiresIn).toBe(900);
    },
  );

  it.each(Object.values(RefreshTokenRevokedReason))(
    'phat hien reuse cho ly do %s',
    async (reason: RefreshTokenRevokedReason): Promise<void> => {
      const { service, repository, accessToken }: ServiceFixture = await createService(
        createSession(reason),
      );
      await expectErrorCode(service.refresh('old-token'), AuthErrorCode.AUTH_REFRESH_TOKEN_REUSED);
      expect(repository.revokeFamily).toHaveBeenCalledWith({
        adminUserId: 'admin-id',
        familyId: 'family-id',
        revokedAt: NOW,
        revokedReason: RefreshTokenRevokedReason.REUSE_DETECTED,
      });
      expect(repository.rotateRefreshSession).not.toHaveBeenCalled();
      expect(accessToken.signAccessToken).not.toHaveBeenCalled();
    },
  );

  it('tu choi token khong ton tai', async (): Promise<void> => {
    const { service, repository }: ServiceFixture = await createService(null);
    await expectErrorCode(service.refresh('unknown'), AuthErrorCode.AUTH_UNAUTHORIZED);
    expect(repository.rotateRefreshSession).not.toHaveBeenCalled();
    expect(repository.findRefreshSessionStateById).not.toHaveBeenCalled();
  });

  it('kiem tra admin inactive truoc reuse', async (): Promise<void> => {
    const session: AuthRefreshSessionContext = createSession(RefreshTokenRevokedReason.ADMIN_DISABLED);
    session.adminUser.isActive = false;
    const { service, repository }: ServiceFixture = await createService(session);
    await expectErrorCode(service.refresh('token'), AuthErrorCode.AUTH_UNAUTHORIZED);
    expect(repository.revokeFamily).not.toHaveBeenCalled();
    expect(repository.rotateRefreshSession).not.toHaveBeenCalled();
  });

  it.each(['expiresAt', 'familyExpiresAt'] as const)(
    'tu choi khi %s da het han',
    async (field: 'expiresAt' | 'familyExpiresAt'): Promise<void> => {
      const session: AuthRefreshSessionContext = createSession();
      session[field] = NOW;
      const { service, repository }: ServiceFixture = await createService(session);
      await expectErrorCode(service.refresh('token'), AuthErrorCode.AUTH_SESSION_EXPIRED);
      expect(repository.rotateRefreshSession).not.toHaveBeenCalled();
    },
  );

  it.each(['revoked', 'expired', 'missing', 'unchanged'] as const)(
    'doc lai trang thai %s sau claim that bai',
    async (state: 'revoked' | 'unchanged' | 'expired' | 'missing'): Promise<void> => {
      const { service, repository, accessToken }: ServiceFixture = await createService();
      repository.rotateRefreshSession.mockResolvedValue(null);
      const latest: AuthRefreshSessionState = createSessionState(createSession());
      let code: AuthErrorCode = AuthErrorCode.AUTH_UNAUTHORIZED;
      if (state === 'revoked') {
        latest.revokedAt = NOW;
        latest.revokedReason = RefreshTokenRevokedReason.LOGOUT;
        code = AuthErrorCode.AUTH_REFRESH_TOKEN_REUSED;
      }
      if (state === 'expired') {
        latest.expiresAt = NOW;
        code = AuthErrorCode.AUTH_SESSION_EXPIRED;
      }
      repository.findRefreshSessionStateById.mockResolvedValue(latest);
      if (state === 'missing') {
        repository.findRefreshSessionStateById.mockResolvedValue(null);
      }
      await expectErrorCode(service.refresh('token'), code);
      expect(repository.findRefreshSessionStateById).toHaveBeenCalledExactlyOnceWith('session-id');
      expect(accessToken.signAccessToken).not.toHaveBeenCalled();
      if (state === 'revoked') {
        expect(repository.revokeFamily).toHaveBeenCalledOnce();
      } else {
        expect(repository.revokeFamily).not.toHaveBeenCalled();
      }
    },
  );
});
