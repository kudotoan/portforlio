import { UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { authConfig } from '../../../../config/namespaces/auth.config.js';
import { AuthController } from '../../auth.controller.js';
import { AuthErrorCode } from '../../constants/auth-error-code.constant.js';
import { AuthService } from '../../services/auth.service.js';

function createController() {
  const refresh = vi.fn();
  const clearCookie = vi.fn();
  const cookie = vi.fn();
  const setHeader = vi.fn();
  const response = { clearCookie, cookie, setHeader } as unknown as Response;
  const request = { cookies: { refreshToken: 'old-token' } } as unknown as Request;
  const configuration = {
    refreshCookieName: 'refreshToken',
    refreshCookiePath: '/admin/auth',
    refreshCookieSecure: false,
    refreshCookieSameSite: 'strict',
  } as ConfigType<typeof authConfig>;
  const controller = new AuthController(
    { refresh } as unknown as AuthService,
    configuration,
  );

  return { controller, request, response, refresh, clearCookie, cookie, setHeader };
}

describe('AuthController refresh cookie', () => {
  it('clears the cookie and preserves the reuse error', async () => {
    const { controller, request, response, refresh, clearCookie, cookie, setHeader } = createController();
    refresh.mockRejectedValue(new UnauthorizedException({
      code: AuthErrorCode.AUTH_REFRESH_TOKEN_REUSED,
      message: 'Refresh token reuse detected.',
    }));

    let caughtError: unknown;

    try {
      await controller.refresh(request, response);
    } catch (error: unknown) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(UnauthorizedException);
    expect((caughtError as UnauthorizedException).getResponse()).toMatchObject({
      code: AuthErrorCode.AUTH_REFRESH_TOKEN_REUSED,
    });
    expect(refresh).toHaveBeenCalledWith('old-token');
    expect(clearCookie).toHaveBeenCalledWith('refreshToken', {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/admin/auth',
    });
    expect(cookie).not.toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
  });

  it('sets a new cookie and returns the refreshed access token', async () => {
    const { controller, request, response, refresh, clearCookie, cookie } = createController();
    refresh.mockResolvedValue({
      accessToken: 'new-access-token',
      expiresIn: 900,
      refreshToken: 'new-refresh-token',
      refreshTokenExpiresAt: new Date(Date.now() + 60_000),
    });

    const result = await controller.refresh(request, response);

    expect(result).toEqual({ accessToken: 'new-access-token', expiresIn: 900 });
    expect(cookie).toHaveBeenCalledWith('refreshToken', 'new-refresh-token', {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/admin/auth',
      maxAge: expect.any(Number),
    });
    expect(clearCookie).not.toHaveBeenCalled();
  });
});
