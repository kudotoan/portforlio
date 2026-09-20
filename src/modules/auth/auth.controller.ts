import { Controller, HttpCode, HttpStatus, Inject, Post, Body, Res, Req, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request, Response } from 'express';

import { authConfig } from '../../config/namespaces/auth.config.js';
import { LoginRequestDto } from './dto/login-request.dto.js';
import { LoginResponse } from './models/login-response.model.js';
import { AuthService, type LoginResult, type RefreshResult } from './services/auth.service.js';
import { RefreshResponse } from './models/refresh-response.model.js';
import { AuthErrorCode } from './constants/auth-error-code.constant.js';

@Controller('admin/auth')
export class AuthController {

  constructor(
    private readonly authService: AuthService,
    @Inject(authConfig.KEY) private readonly configuration: ConfigType<typeof authConfig>,
  ) {

  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() request: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {

    const result: LoginResult = await this.authService.login(request);

    const maxAge: number = Math.max(
      0,
      result.refreshTokenExpiresAt.getTime() - Date.now(),
    );

    response.cookie(
      this.configuration.refreshCookieName,
      result.refreshToken,
      {
        httpOnly: true,
        secure: this.configuration.refreshCookieSecure,
        sameSite: this.configuration.refreshCookieSameSite,
        path: this.configuration.refreshCookiePath,
        maxAge: maxAge,
      },
    );

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');

    return result.response;

  }

  @Post('refresh')
@HttpCode(HttpStatus.OK)
async refresh(
  @Req() request: Request,
  @Res({ passthrough: true }) response: Response,
): Promise<RefreshResponse> {

  const refreshTokenValue: unknown = request.cookies?.[this.configuration.refreshCookieName];

  if (typeof refreshTokenValue !== 'string' || refreshTokenValue.length === 0) {

    throw new UnauthorizedException({
      code: AuthErrorCode.AUTH_UNAUTHORIZED,
      message: 'Unauthorized.',
    });

  }

  const result: RefreshResult = await this.authService.refresh(refreshTokenValue);

  const maxAge: number = Math.max(
    0,
    result.refreshTokenExpiresAt.getTime() - Date.now(),
  );

  response.cookie(
    this.configuration.refreshCookieName,
    result.refreshToken,
    {
      httpOnly: true,
      secure: this.configuration.refreshCookieSecure,
      sameSite: this.configuration.refreshCookieSameSite,
      path: this.configuration.refreshCookiePath,
      maxAge: maxAge,
    },
  );

  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');

  return result.response;

}

}