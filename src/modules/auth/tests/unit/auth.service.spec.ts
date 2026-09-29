import { UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { authConfig } from '../../../../config/namespaces/auth.config.js';
import { AdminRole, RefreshTokenRevokedReason } from '../../../../generated/prisma/enums.js';
import { AuthErrorCode } from '../../constants/auth-error-code.constant.js';
import type { AuthRefreshSessionWithAdmin } from '../../models/refresh-session.model.js';
import { AuthRepository } from '../../repositories/auth.repository.js';
import { AccessTokenService } from '../../services/access-token.service.js';
import { AuthService } from '../../services/auth.service.js';
import { PasswordHasherService } from '../../services/password-hasher.service.js';
import { RefreshTokenService } from '../../services/refresh-token.service.js';

function createSession(revokedReason: RefreshTokenRevokedReason | null): AuthRefreshSessionWithAdmin {
  const now: Date = new Date();

  return {
    id: 'session-id',
    adminUserId: 'admin-id',
    tokenHash: 'token-hash',
    familyId: 'family-id',
    familyExpiresAt: new Date(now.getTime() + 90_000),
    expiresAt: new Date(now.getTime() + 60_000),
    revokedAt: revokedReason === null ? null : now,
    revokedReason: revokedReason,
    replacedById: null,
    lastUsedAt: null,
    createdAt: now,
    adminUser: {
      id: 'admin-id',
      username: 'owner',
      passwordHash: 'password-hash',
      role: AdminRole.OWNER,
      isActive: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    },
  };
}

function createService(
  currentSession: AuthRefreshSessionWithAdmin,
  latestSession: AuthRefreshSessionWithAdmin = currentSession,
) {
  const repository = {
    findSessionByTokenHash: vi.fn().mockResolvedValue(currentSession),
    findSessionWithAdminById: vi.fn()
      .mockResolvedValueOnce(currentSession)
      .mockResolvedValueOnce(latestSession),
    rotateRefreshSession: vi.fn().mockResolvedValue(null),
    revokeFamily: vi.fn().mockResolvedValue(0),
  };

  const configuration = {
    refreshIdleTtlSeconds: 7 * 24 * 60 * 60,
  } as ConfigType<typeof authConfig>;

  const service = new AuthService(
    repository as unknown as AuthRepository,
    {} as PasswordHasherService,
    {} as AccessTokenService,
    new RefreshTokenService(),
    configuration,
  );

  return { service, repository };
}

async function expectReuse(service: AuthService): Promise<void> {
  let caughtError: unknown;

  try {
    await service.refresh('raw-refresh-token');
  } catch (error: unknown) {
    caughtError = error;
  }

  expect(caughtError).toBeInstanceOf(UnauthorizedException);
  expect((caughtError as UnauthorizedException).getResponse()).toMatchObject({
    code: AuthErrorCode.AUTH_REFRESH_TOKEN_REUSED,
  });
}

describe('AuthService refresh reuse', () => {
  it.each([
    RefreshTokenRevokedReason.LOGOUT,
    RefreshTokenRevokedReason.PASSWORD_CHANGED,
    RefreshTokenRevokedReason.REUSE_DETECTED,
    RefreshTokenRevokedReason.ADMIN_DISABLED,
  ])('detects reuse of a session revoked for %s', async (reason) => {
    const { service, repository } = createService(createSession(reason));

    await expectReuse(service);

    expect(repository.revokeFamily).toHaveBeenCalledWith({
      adminUserId: 'admin-id',
      familyId: 'family-id',
      revokedAt: expect.any(Date),
      revokedReason: RefreshTokenRevokedReason.REUSE_DETECTED,
    });
    expect(repository.rotateRefreshSession).not.toHaveBeenCalled();
  });

  it('detects revocation after a failed rotation claim', async () => {
    const currentSession: AuthRefreshSessionWithAdmin = createSession(null);
    const latestSession: AuthRefreshSessionWithAdmin = createSession(
      RefreshTokenRevokedReason.LOGOUT,
    );
    const { service, repository } = createService(currentSession, latestSession);

    await expectReuse(service);

    expect(repository.rotateRefreshSession).toHaveBeenCalledOnce();
    expect(repository.revokeFamily).toHaveBeenCalledWith({
      adminUserId: 'admin-id',
      familyId: 'family-id',
      revokedAt: expect.any(Date),
      revokedReason: RefreshTokenRevokedReason.REUSE_DETECTED,
    });
  });
});
