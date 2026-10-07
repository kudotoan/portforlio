import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import {
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import { AdminRole } from '../../../../generated/prisma/enums.js';
import { AuthErrorCode } from '../../constants/auth-error-code.constant.js';
import { AuthorizationGuard } from '../../guards/authorization.guard.js';
import type { CurrentAdmin } from '../../models/current-admin.model.js';
import type { AuthenticatedRequest } from '../../types/authenticated-request.type.js';

type ReflectorMock = {
  getAllAndOverride: Mock<Reflector['getAllAndOverride']>;
};

type GuardFixture = {
  guard: AuthorizationGuard;
  reflector: ReflectorMock;
};

function createCurrentAdmin(
  role: AdminRole = AdminRole.OWNER,
): CurrentAdmin {
  return {
    id: 'admin-id',
    username: 'owner',
    role: role,
    mustChangePassword: false,
  };
}

function createRequest(
  currentAdmin?: CurrentAdmin,
): Request {
  const request: Request = {
    headers: {},
  } as Request;

  if (currentAdmin !== undefined) {
    const authenticatedRequest: AuthenticatedRequest =
      request as AuthenticatedRequest;

    authenticatedRequest.currentAdmin = currentAdmin;
  }

  return request;
}

function createExecutionContext(
  request: Request,
): ExecutionContext {
  const handler = function handler(): void {};

  class TestController {}

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),

    getHandler: () => handler,

    getClass: () => TestController,
  } as unknown as ExecutionContext;
}

async function createGuard(): Promise<GuardFixture> {
  const reflector: ReflectorMock = {
    getAllAndOverride:
      vi.fn<Reflector['getAllAndOverride']>(),
  };

  const testingModule: TestingModule =
    await Test.createTestingModule({
      providers: [
        AuthorizationGuard,
        {
          provide: Reflector,
          useValue: reflector,
        },
      ],
    }).compile();

  const guard: AuthorizationGuard =
    testingModule.get(AuthorizationGuard);

  return {
    guard: guard,
    reflector: reflector,
  };
}

function expectForbiddenError(
  operation: () => boolean,
): void {
  let caughtError: unknown;

  try {
    operation();
  } catch (error: unknown) {
    caughtError = error;
  }

  expect(caughtError).toBeInstanceOf(
    ForbiddenException,
  );

  if (!(caughtError instanceof ForbiddenException)) {
    throw new Error(
      'Expected ForbiddenException.',
    );
  }

  expect(caughtError.getResponse()).toMatchObject({
    code: AuthErrorCode.AUTH_FORBIDDEN,
  });
}

function expectUnauthorizedError(
  operation: () => boolean,
): void {
  let caughtError: unknown;

  try {
    operation();
  } catch (error: unknown) {
    caughtError = error;
  }

  expect(caughtError).toBeInstanceOf(
    UnauthorizedException,
  );

  if (!(caughtError instanceof UnauthorizedException)) {
    throw new Error(
      'Expected UnauthorizedException.',
    );
  }

  expect(caughtError.getResponse()).toMatchObject({
    code: AuthErrorCode.AUTH_UNAUTHORIZED,
  });
}

describe('AuthorizationGuard', (): void => {
  it('cho phep khi route khong yeu cau role', async (): Promise<void> => {
    const {
      guard,
      reflector,
    }: GuardFixture = await createGuard();

    reflector.getAllAndOverride
      .mockReturnValue(undefined);

    const request: Request =
      createRequest();

    const context: ExecutionContext =
      createExecutionContext(request);

    const result: boolean =
      guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('cho phep OWNER khi route yeu cau OWNER', async (): Promise<void> => {
    const {
      guard,
      reflector,
    }: GuardFixture = await createGuard();

    reflector.getAllAndOverride
      .mockReturnValue([
        AdminRole.OWNER,
      ]);

    const request: Request =
      createRequest(
        createCurrentAdmin(AdminRole.OWNER),
      );

    const context: ExecutionContext =
      createExecutionContext(request);

    const result: boolean =
      guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('tu choi EDITOR khi route chi yeu cau OWNER', async (): Promise<void> => {
    const {
      guard,
      reflector,
    }: GuardFixture = await createGuard();

    reflector.getAllAndOverride
      .mockReturnValue([
        AdminRole.OWNER,
      ]);

    const request: Request =
      createRequest(
        createCurrentAdmin(AdminRole.EDITOR),
      );

    const context: ExecutionContext =
      createExecutionContext(request);

    expectForbiddenError(
      () => guard.canActivate(context),
    );
  });

  it.each([
    AdminRole.OWNER,
    AdminRole.EDITOR,
  ])(
    'cho phep %s khi route chap nhan OWNER va EDITOR',
    async (role: AdminRole): Promise<void> => {
      const {
        guard,
        reflector,
      }: GuardFixture = await createGuard();

      reflector.getAllAndOverride
        .mockReturnValue([
          AdminRole.OWNER,
          AdminRole.EDITOR,
        ]);

      const request: Request =
        createRequest(
          createCurrentAdmin(role),
        );

      const context: ExecutionContext =
        createExecutionContext(request);

      const result: boolean =
        guard.canActivate(context);

      expect(result).toBe(true);
    },
  );

  it('cho phep khi danh sach required roles rong', async (): Promise<void> => {
    const {
      guard,
      reflector,
    }: GuardFixture = await createGuard();

    reflector.getAllAndOverride
      .mockReturnValue([]);

    const request: Request =
      createRequest();

    const context: ExecutionContext =
      createExecutionContext(request);

    const result: boolean =
      guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('tu choi khi route yeu cau role nhung khong co currentAdmin', async (): Promise<void> => {
    const {
      guard,
      reflector,
    }: GuardFixture = await createGuard();

    reflector.getAllAndOverride
      .mockReturnValue([
        AdminRole.OWNER,
      ]);

    const request: Request =
      createRequest();

    const context: ExecutionContext =
      createExecutionContext(request);

    expectUnauthorizedError(
      () => guard.canActivate(context),
    );
  });

  it('doc required roles tu handler va class', async (): Promise<void> => {
    const {
      guard,
      reflector,
    }: GuardFixture = await createGuard();

    reflector.getAllAndOverride
      .mockReturnValue([
        AdminRole.OWNER,
      ]);

    const request: Request =
      createRequest(
        createCurrentAdmin(AdminRole.OWNER),
      );

    const context: ExecutionContext =
      createExecutionContext(request);

    guard.canActivate(context);

    expect(
      reflector.getAllAndOverride,
    ).toHaveBeenCalledExactlyOnceWith(
      'requiredRoles',
      [
        context.getHandler(),
        context.getClass(),
      ],
    );
  });
});