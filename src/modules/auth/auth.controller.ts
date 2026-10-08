import { Get, UseGuards, Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res, UnauthorizedException, Patch } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { ApiBearerAuth } from '@nestjs/swagger';

import { authConfig } from '../../config/namespaces/auth.config.js';
import { AuthErrorCode } from './constants/auth-error-code.constant.js';
import { LoginRequestDto } from './dto/request/login-request.dto.js';
import { LoginResponseDto } from './dto/response/login-response.dto.js';
import { RefreshResponseDto } from './dto/response/refresh-response.dto.js';
import { AuthService } from './services/auth.service.js';
import type { ChangePasswordInput, LoginInput, LoginResult, RefreshResult } from './types/auth-service.type.js';

import { CurrentAdmin } from './decorators/current-admin.decorator.js';
import { AuthAdminResponseDto } from './dto/response/auth-admin-response.dto.js';
import { AuthenticationGuard } from './guards/authentication.guard.js';
import type { CurrentAdmin as CurrentAdminModel } from './models/current-admin.model.js';
import { ChangePasswordRequestDto } from './dto/request/change-password-request.dto.js';
import { OriginGuard } from './guards/origin.guard.js';
@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(authConfig.KEY) private readonly configuration: ConfigType<typeof authConfig>,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginGuard)
  async login(
    @Body() request: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const input: LoginInput = {
      username: request.username,
      password: request.password,
    };
    const result: LoginResult = await this.authService.login(input);

    const maxAge: number = Math.max(
      0,
      result.refreshTokenExpiresAt.getTime() - Date.now(),
    );

    response.cookie(this.configuration.refreshCookieName, result.refreshToken, {
      ...this.getRefreshCookieOptions(),
      maxAge: maxAge,
    });
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');

    const body: LoginResponseDto = {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      admin: {
        id: result.admin.id,
        username: result.admin.username,
        role: result.admin.role,
        mustChangePassword: result.admin.mustChangePassword,
      },
    };

    return body;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginGuard)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');

    const refreshTokenValue: unknown = request.cookies?.[this.configuration.refreshCookieName];

    if (typeof refreshTokenValue !== 'string' || refreshTokenValue.length === 0) {
      throw new UnauthorizedException({
        code: AuthErrorCode.AUTH_UNAUTHORIZED,
        message: 'Unauthorized.',
      });
    }

    let result: RefreshResult;

    try {
      result = await this.authService.refresh(refreshTokenValue);
    } catch (error: unknown) {
      if (this.isRefreshTokenReuseError(error)) {
        response.clearCookie(
          this.configuration.refreshCookieName,
          this.getRefreshCookieOptions(),
        );
      }

      throw error;
    }

    const maxAge: number = Math.max(
      0,
      result.refreshTokenExpiresAt.getTime() - Date.now(),
    );

    response.cookie(this.configuration.refreshCookieName, result.refreshToken, {
      ...this.getRefreshCookieOptions(),
      maxAge: maxAge,
    });

    const body: RefreshResponseDto = {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };

    return body;
  }

  @Get('me')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  public getMe(
    @CurrentAdmin() currentAdmin: CurrentAdminModel,
    @Res({ passthrough: true }) response: Response,
  ): AuthAdminResponseDto {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');

    const body: AuthAdminResponseDto = {
      id: currentAdmin.id,
      username: currentAdmin.username,
      role: currentAdmin.role,
      mustChangePassword: currentAdmin.mustChangePassword,
    };

    return body;
  }



  @Patch('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  public async changePassword(
    @CurrentAdmin() currentAdmin: CurrentAdminModel,
    @Body() request: ChangePasswordRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const input: ChangePasswordInput = {
      adminUserId: currentAdmin.id,
      username: currentAdmin.username,
      currentPassword: request.currentPassword,
      newPassword: request.newPassword,
    };

    await this.authService.changePassword(input);

    response.clearCookie(
      this.configuration.refreshCookieName,
      this.getRefreshCookieOptions(),
    );

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
  }


  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginGuard)
  public async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshTokenValue: unknown =
      request.cookies?.[this.configuration.refreshCookieName];

    if (
      typeof refreshTokenValue === 'string'
      && refreshTokenValue.length > 0
    ) {
      await this.authService.logout(refreshTokenValue);
    }

    response.clearCookie(
      this.configuration.refreshCookieName,
      this.getRefreshCookieOptions(),
    );

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
  }

  private getRefreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configuration.refreshCookieSecure,
      sameSite: this.configuration.refreshCookieSameSite,
      path: this.configuration.refreshCookiePath,
    };
  }

  private isRefreshTokenReuseError(error: unknown): boolean {
    if (!(error instanceof UnauthorizedException)) {
      return false;
    }

    const errorResponse: string | object = error.getResponse();

    return typeof errorResponse === 'object'
      && errorResponse !== null
      && 'code' in errorResponse
      && errorResponse.code === AuthErrorCode.AUTH_REFRESH_TOKEN_REUSED;
  }
}
