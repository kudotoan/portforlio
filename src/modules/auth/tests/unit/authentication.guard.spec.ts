import {
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import {
  AdminRole,
  RefreshTokenRevokedReason,
} from '../../../../generated/prisma/enums.js';
import { AuthErrorCode } from '../../constants/auth-error-code.constant.js';
import { AuthenticationGuard } from '../../guards/authentication.guard.js';
import type { AuthAccessSession } from '../../models/access-session.model.js';
import { AuthRepository } from '../../repositories/auth.repository.js';
import { AccessTokenService } from '../../services/access-token.service.js';
import type { AccessTokenPayload } from '../../types/access-token-payload.type.js';
import type { AuthenticatedRequest } from '../../types/authenticated-request.type.js';

type RepositoryMock = {
  findAccessSessionById: Mock<AuthRepository['findAccessSessionById']>;
};

type AccessTokenServiceMock = {
  verifyAccessToken: Mock<AccessTokenService['verifyAccessToken']>;
};

type GuardFixture = {
  guard: AuthenticationGuard;
  repository: RepositoryMock;
  accessTokenService: AccessTokenServiceMock;
};

const NOW: Date = new Date('2026-10-07T00:00:00.000Z');

const payload: AccessTokenPayload = {
  sub: 'admin-id',
  sid: 'session-id',
  jti: 'token-id',
  tokenUse: 'access',
  iat: 1,
  exp: 2,
};

function createSession(): AuthAccessSession {
  return {
    id: 'session-id',
    adminUserId: 'admin-id',

    expiresAt: new Date(NOW.getTime() + 60_000),
    familyExpiresAt: new Date(NOW.getTime() + 120_000),

    revokedAt: null,
    revokedReason: null,

    replacedById: null,

    adminUser: {
      id: 'admin-id',
      username: 'owner',
      role: AdminRole.OWNER,
      isActive: true,
      mustChangePassword: false,
    },
  };
}

function createRequest(
  authorization?: string,
): Request {
  return {
    headers: {
      authorization: authorization,
    },
  } as Request;
}

function createExecutionContext(
  request: Request,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

async function createGuard(): Promise<GuardFixture> {
  const repository: RepositoryMock = {
    findAccessSessionById:
      vi.fn<AuthRepository['findAccessSessionById']>(),
  };

  const accessTokenService: AccessTokenServiceMock = {
    verifyAccessToken:
      vi.fn<AccessTokenService['verifyAccessToken']>(),
  };

  const testingModule: TestingModule =
    await Test.createTestingModule({
      providers: [
        AuthenticationGuard,
        {
          provide: AuthRepository,
          useValue: repository,
        },
        {
          provide: AccessTokenService,
          useValue: accessTokenService,
        },
      ],
    }).compile();

  const guard: AuthenticationGuard =
    testingModule.get(AuthenticationGuard);

  return {
    guard: guard,
    repository: repository,
    accessTokenService: accessTokenService,
  };
}

async function expectErrorCode(
  operation: Promise<unknown>,
  code: AuthErrorCode,
): Promise<void> {
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

describe('AuthenticationGuard', (): void => {
  it('tu choi request khong co Authorization header', async (): Promise<void> => {
    const {
      guard,
      repository,
      accessTokenService,
    }: GuardFixture = await createGuard();

    const request: Request = createRequest();
    const context: ExecutionContext =
      createExecutionContext(request);

    await expectErrorCode(
      guard.canActivate(context),
      AuthErrorCode.AUTH_UNAUTHORIZED,
    );

    expect(accessTokenService.verifyAccessToken)
      .not.toHaveBeenCalled();

    expect(repository.findAccessSessionById)
      .not.toHaveBeenCalled();
  });

  it.each([
    '',
    'Bearer',
    'Basic token',
    'Token abc',
    'Bearer token extra',
  ])(
    'tu choi Authorization header khong hop le: "%s"',
    async (authorization: string): Promise<void> => {
      const {
        guard,
        repository,
        accessTokenService,
      }: GuardFixture = await createGuard();

      const request: Request =
        createRequest(authorization);

      const context: ExecutionContext =
        createExecutionContext(request);

      await expectErrorCode(
        guard.canActivate(context),
        AuthErrorCode.AUTH_UNAUTHORIZED,
      );

      expect(accessTokenService.verifyAccessToken)
        .not.toHaveBeenCalled();

      expect(repository.findAccessSessionById)
        .not.toHaveBeenCalled();
    },
  );

  it('tu choi khi access token khong hop le', async (): Promise<void> => {
    const {
      guard,
      repository,
      accessTokenService,
    }: GuardFixture = await createGuard();

    accessTokenService.verifyAccessToken
      .mockRejectedValue(new Error('Invalid token'));

    const request: Request =
      createRequest('Bearer invalid-token');

    const context: ExecutionContext =
      createExecutionContext(request);

    await expectErrorCode(
      guard.canActivate(context),
      AuthErrorCode.AUTH_UNAUTHORIZED,
    );

    expect(accessTokenService.verifyAccessToken)
      .toHaveBeenCalledExactlyOnceWith('invalid-token');

    expect(repository.findAccessSessionById)
      .not.toHaveBeenCalled();
  });

  it('tu choi khi session khong ton tai', async (): Promise<void> => {
    const {
      guard,
      repository,
      accessTokenService,
    }: GuardFixture = await createGuard();

    accessTokenService.verifyAccessToken
      .mockResolvedValue(payload);

    repository.findAccessSessionById
      .mockResolvedValue(null);

    const request: Request =
      createRequest('Bearer valid-token');

    const context: ExecutionContext =
      createExecutionContext(request);

    await expectErrorCode(
      guard.canActivate(context),
      AuthErrorCode.AUTH_UNAUTHORIZED,
    );

    expect(repository.findAccessSessionById)
      .toHaveBeenCalledExactlyOnceWith('session-id');
  });

  it('tu choi khi session khong thuoc admin trong access token', async (): Promise<void> => {
    const {
      guard,
      repository,
      accessTokenService,
    }: GuardFixture = await createGuard();

    const session: AuthAccessSession =
      createSession();

    session.adminUserId = 'another-admin-id';

    accessTokenService.verifyAccessToken
      .mockResolvedValue(payload);

    repository.findAccessSessionById
      .mockResolvedValue(session);

    const request: Request =
      createRequest('Bearer valid-token');

    const context: ExecutionContext =
      createExecutionContext(request);

    await expectErrorCode(
      guard.canActivate(context),
      AuthErrorCode.AUTH_UNAUTHORIZED,
    );
  });

  it('tu choi khi admin relation khong khop voi access token', async (): Promise<void> => {
    const {
      guard,
      repository,
      accessTokenService,
    }: GuardFixture = await createGuard();

    const session: AuthAccessSession =
      createSession();

    session.adminUser.id = 'another-admin-id';

    accessTokenService.verifyAccessToken
      .mockResolvedValue(payload);

    repository.findAccessSessionById
      .mockResolvedValue(session);

    const request: Request =
      createRequest('Bearer valid-token');

    const context: ExecutionContext =
      createExecutionContext(request);

    await expectErrorCode(
      guard.canActivate(context),
      AuthErrorCode.AUTH_UNAUTHORIZED,
    );
  });

  it('tu choi khi session da bi revoked', async (): Promise<void> => {
    const {
      guard,
      repository,
      accessTokenService,
    }: GuardFixture = await createGuard();

    const session: AuthAccessSession =
      createSession();

    session.revokedAt = NOW;

    accessTokenService.verifyAccessToken
      .mockResolvedValue(payload);

    repository.findAccessSessionById
      .mockResolvedValue(session);

    const request: Request =
      createRequest('Bearer valid-token');

    const context: ExecutionContext =
      createExecutionContext(request);

    await expectErrorCode(
      guard.canActivate(context),
      AuthErrorCode.AUTH_UNAUTHORIZED,
    );
  });

  it('tu choi khi session co revoked reason', async (): Promise<void> => {
    const {
      guard,
      repository,
      accessTokenService,
    }: GuardFixture = await createGuard();

    const session: AuthAccessSession =
      createSession();

    session.revokedReason =
      RefreshTokenRevokedReason.LOGOUT;

    accessTokenService.verifyAccessToken
      .mockResolvedValue(payload);

    repository.findAccessSessionById
      .mockResolvedValue(session);

    const request: Request =
      createRequest('Bearer valid-token');

    const context: ExecutionContext =
      createExecutionContext(request);

    await expectErrorCode(
      guard.canActivate(context),
      AuthErrorCode.AUTH_UNAUTHORIZED,
    );
  });

  it('tu choi access token cua session da bi rotate', async (): Promise<void> => {
    const {
      guard,
      repository,
      accessTokenService,
    }: GuardFixture = await createGuard();

    const session: AuthAccessSession =
      createSession();

    session.replacedById = 'new-session-id';

    accessTokenService.verifyAccessToken
      .mockResolvedValue(payload);

    repository.findAccessSessionById
      .mockResolvedValue(session);

    const request: Request =
      createRequest('Bearer valid-token');

    const context: ExecutionContext =
      createExecutionContext(request);

    await expectErrorCode(
      guard.canActivate(context),
      AuthErrorCode.AUTH_UNAUTHORIZED,
    );
  });

  it.each([
    'expiresAt',
    'familyExpiresAt',
  ] as const)(
    'tu choi khi %s da het han',
    async (
      field: 'expiresAt' | 'familyExpiresAt',
    ): Promise<void> => {
      const {
        guard,
        repository,
        accessTokenService,
      }: GuardFixture = await createGuard();

      const session: AuthAccessSession =
        createSession();

      session[field] = NOW;

      accessTokenService.verifyAccessToken
        .mockResolvedValue(payload);

      repository.findAccessSessionById
        .mockResolvedValue(session);

      const request: Request =
        createRequest('Bearer valid-token');

      const context: ExecutionContext =
        createExecutionContext(request);

      await expectErrorCode(
        guard.canActivate(context),
        AuthErrorCode.AUTH_SESSION_EXPIRED,
      );
    },
  );

  it('tu choi khi admin da bi vo hieu hoa', async (): Promise<void> => {
    const {
      guard,
      repository,
      accessTokenService,
    }: GuardFixture = await createGuard();

    const session: AuthAccessSession =
      createSession();

    session.adminUser.isActive = false;

    accessTokenService.verifyAccessToken
      .mockResolvedValue(payload);

    repository.findAccessSessionById
      .mockResolvedValue(session);

    const request: Request =
      createRequest('Bearer valid-token');

    const context: ExecutionContext =
      createExecutionContext(request);

    await expectErrorCode(
      guard.canActivate(context),
      AuthErrorCode.AUTH_UNAUTHORIZED,
    );
  });

  it('cho phep request hop le va gan currentAdmin vao request', async (): Promise<void> => {
    const {
      guard,
      repository,
      accessTokenService,
    }: GuardFixture = await createGuard();

    const session: AuthAccessSession =
      createSession();

    accessTokenService.verifyAccessToken
      .mockResolvedValue(payload);

    repository.findAccessSessionById
      .mockResolvedValue(session);

    const request: Request =
      createRequest('Bearer valid-token');

    const context: ExecutionContext =
      createExecutionContext(request);

    const result: boolean =
      await guard.canActivate(context);

    expect(result).toBe(true);

    expect(accessTokenService.verifyAccessToken)
      .toHaveBeenCalledExactlyOnceWith('valid-token');

    expect(repository.findAccessSessionById)
      .toHaveBeenCalledExactlyOnceWith('session-id');

    const authenticatedRequest: AuthenticatedRequest =
      request as AuthenticatedRequest;

    expect(authenticatedRequest.currentAdmin).toEqual({
      id: 'admin-id',
      username: 'owner',
      role: AdminRole.OWNER,
      mustChangePassword: false,
    });
  });
});