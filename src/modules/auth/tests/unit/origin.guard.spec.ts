
import {
  ForbiddenException,
  type ExecutionContext,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { authConfig } from '../../../../config/namespaces/auth.config.js';
import { AuthErrorCode } from '../../constants/auth-error-code.constant.js';
import { OriginGuard } from '../../guards/origin.guard.js';

function createContext(origin?: string): ExecutionContext {
  const request = {
    headers: {
      origin: origin,
    },
  } as unknown as Request;

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

const configuration = {
  allowedOrigins: [
    'https://admin.kudotoan.com',
  ],
} as ConfigType<typeof authConfig>;

describe('OriginGuard', () => {
  const guard: OriginGuard = new OriginGuard(configuration);

  it('chap nhan Origin hop le', () => {
    const context = createContext(
      'https://admin.kudotoan.com',
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('tu choi Origin khong hop le', () => {
    const context = createContext(
      'https://evil.example',
    );

    expect(() => guard.canActivate(context))
      .toThrow(ForbiddenException);
  });

  it('tu choi request thieu Origin', () => {
    const context = createContext();

    expect(() => guard.canActivate(context))
      .toThrow(ForbiddenException);
  });

  it('tu choi subdomain gia mao', () => {
    const context = createContext(
      'https://admin.kudotoan.com.evil.example',
    );

    expect(() => guard.canActivate(context))
      .toThrow(ForbiddenException);
  });

  it('tra dung error code', () => {
    const context = createContext(
      'https://evil.example',
    );

    try {
      guard.canActivate(context);
      throw new Error('Expected OriginGuard to reject request.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ForbiddenException);

      if (!(error instanceof ForbiddenException)) {
        throw error;
      }

      expect(error.getResponse()).toMatchObject({
        code: AuthErrorCode.AUTH_ORIGIN_NOT_ALLOWED,
      });
    }
  });
});
