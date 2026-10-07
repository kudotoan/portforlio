import {
  Controller,
  Get,
  type INestApplication,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import { AdminRole } from '../../../../generated/prisma/enums.js';
import { CurrentAdmin } from '../../decorators/current-admin.decorator.js';
import { RequireRoles } from '../../decorators/require-roles.decorator.js';
import { AuthenticationGuard } from '../../guards/authentication.guard.js';
import { AuthorizationGuard } from '../../guards/authorization.guard.js';
import { PasswordChangeGuard } from '../../guards/password-change.guard.js';
import type { AuthAccessSession } from '../../models/access-session.model.js';
import type { CurrentAdmin as CurrentAdminModel } from '../../models/current-admin.model.js';
import { AuthRepository } from '../../repositories/auth.repository.js';
import { AccessTokenService } from '../../services/access-token.service.js';
import type { AccessTokenPayload } from '../../types/access-token-payload.type.js';

type RepositoryMock = {
  findAccessSessionById: Mock<AuthRepository['findAccessSessionById']>;
};

type AccessTokenServiceMock = {
  verifyAccessToken: Mock<AccessTokenService['verifyAccessToken']>;
};

const payload: AccessTokenPayload = {
  sub: 'admin-id',
  sid: 'session-id',
  jti: 'token-id',
  tokenUse: 'access',
  iat: 1,
  exp: 2,
};

function createSession(
  role: AdminRole = AdminRole.OWNER,
  mustChangePassword: boolean = false,
): AuthAccessSession {
  const now: number = Date.now();

  return {
    id: 'session-id',
    adminUserId: 'admin-id',

    expiresAt: new Date(now + 60_000),
    familyExpiresAt: new Date(now + 120_000),

    revokedAt: null,
    revokedReason: null,
    replacedById: null,

    adminUser: {
      id: 'admin-id',
      username: 'owner',
      role: role,
      isActive: true,
      mustChangePassword: mustChangePassword,
    },
  };
}

@Controller('test-auth')
class TestAuthController {
  @Get('owner')
  @UseGuards(
    AuthenticationGuard,
    PasswordChangeGuard,
    AuthorizationGuard,
  )
  @RequireRoles(AdminRole.OWNER)
  public owner(
    @CurrentAdmin() admin: CurrentAdminModel,
  ): CurrentAdminModel {
    return admin;
  }
}

describe('Auth guard composition integration', (): void => {
  let app: INestApplication;

  let repository: RepositoryMock;

  let accessTokenService: AccessTokenServiceMock;

  beforeAll(async (): Promise<void> => {
    repository = {
      findAccessSessionById:
        vi.fn<AuthRepository['findAccessSessionById']>(),
    };

    accessTokenService = {
      verifyAccessToken:
        vi.fn<AccessTokenService['verifyAccessToken']>(),
    };

    const testingModule: TestingModule =
      await Test.createTestingModule({
        controllers: [
          TestAuthController,
        ],

        providers: [
          AuthenticationGuard,
          PasswordChangeGuard,
          AuthorizationGuard,
          Reflector,

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

    app = testingModule.createNestApplication();

    await app.init();
  });

  beforeEach((): void => {
    vi.clearAllMocks();

    accessTokenService.verifyAccessToken
      .mockResolvedValue(payload);

    repository.findAccessSessionById
      .mockResolvedValue(createSession());
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  it('cho phep request khi authentication, password va role deu hop le', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/test-auth/owner')
      .set(
        'Authorization',
        'Bearer valid-token',
      )
      .expect(200);

    expect(response.body).toEqual({
      id: 'admin-id',
      username: 'owner',
      role: AdminRole.OWNER,
      mustChangePassword: false,
    });

    expect(accessTokenService.verifyAccessToken)
      .toHaveBeenCalledExactlyOnceWith(
        'valid-token',
      );

    expect(repository.findAccessSessionById)
      .toHaveBeenCalledExactlyOnceWith(
        'session-id',
      );
  });

  it('tu choi request khong co access token tai AuthenticationGuard', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/test-auth/owner')
      .expect(401);

    expect(response.body).toMatchObject({
      code: 'AUTH_UNAUTHORIZED',
    });

    expect(accessTokenService.verifyAccessToken)
      .not.toHaveBeenCalled();

    expect(repository.findAccessSessionById)
      .not.toHaveBeenCalled();
  });

  it('tu choi tai PasswordChangeGuard khi admin bat buoc doi mat khau', async (): Promise<void> => {
    repository.findAccessSessionById
      .mockResolvedValue(
        createSession(
          AdminRole.OWNER,
          true,
        ),
      );

    const response = await request(app.getHttpServer())
      .get('/test-auth/owner')
      .set(
        'Authorization',
        'Bearer valid-token',
      )
      .expect(403);

    expect(response.body).toMatchObject({
      code: 'AUTH_PASSWORD_CHANGE_REQUIRED',
    });
  });

  it('tu choi tai AuthorizationGuard khi role khong du quyen', async (): Promise<void> => {
    repository.findAccessSessionById
      .mockResolvedValue(
        createSession(
          AdminRole.EDITOR,
          false,
        ),
      );

    const response = await request(app.getHttpServer())
      .get('/test-auth/owner')
      .set(
        'Authorization',
        'Bearer valid-token',
      )
      .expect(403);

    expect(response.body).toMatchObject({
      code: 'AUTH_FORBIDDEN',
    });
  });

  it('@CurrentAdmin nhan dung admin do AuthenticationGuard gan vao request', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/test-auth/owner')
      .set(
        'Authorization',
        'Bearer valid-token',
      )
      .expect(200);

    expect(response.body).toEqual({
      id: 'admin-id',
      username: 'owner',
      role: AdminRole.OWNER,
      mustChangePassword: false,
    });

    expect(response.body).not.toHaveProperty(
      'passwordHash',
    );

    expect(response.body).not.toHaveProperty(
      'isActive',
    );

    expect(response.body).not.toHaveProperty(
      'revokedAt',
    );
  });
});