import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { AdminRole } from '../../../../generated/prisma/enums.js';
import { AuthErrorCode } from '../../constants/auth-error-code.constant.js';
import { PasswordChangeGuard } from '../../guards/password-change.guard.js';
import type { CurrentAdmin } from '../../models/current-admin.model.js';
import type { AuthenticatedRequest } from '../../types/authenticated-request.type.js';

function createCurrentAdmin(
  mustChangePassword: boolean,
): CurrentAdmin {
  return {
    id: 'admin-id',
    username: 'owner',
    role: AdminRole.OWNER,
    mustChangePassword: mustChangePassword,
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
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
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

function expectPasswordChangeRequiredError(
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
    code: AuthErrorCode.AUTH_PASSWORD_CHANGE_REQUIRED,
  });
}

describe('PasswordChangeGuard', (): void => {
  it('cho phep khi admin khong can doi mat khau', (): void => {
    const guard: PasswordChangeGuard =
      new PasswordChangeGuard();

    const request: Request =
      createRequest(
        createCurrentAdmin(false),
      );

    const context: ExecutionContext =
      createExecutionContext(request);

    const result: boolean =
      guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('tu choi khi admin bat buoc doi mat khau', (): void => {
    const guard: PasswordChangeGuard =
      new PasswordChangeGuard();

    const request: Request =
      createRequest(
        createCurrentAdmin(true),
      );

    const context: ExecutionContext =
      createExecutionContext(request);

    expectPasswordChangeRequiredError(
      () => guard.canActivate(context),
    );
  });

  it('tu choi khi khong co currentAdmin', (): void => {
    const guard: PasswordChangeGuard =
      new PasswordChangeGuard();

    const request: Request =
      createRequest();

    const context: ExecutionContext =
      createExecutionContext(request);

    expectUnauthorizedError(
      () => guard.canActivate(context),
    );
  });
});