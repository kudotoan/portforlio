import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthRepository } from './repositories/auth.repository.js';
import { AccessTokenService } from './services/access-token.service.js';
import { PasswordHasherService } from './services/password-hasher.service.js';
import { RefreshTokenService } from './services/refresh-token.service.js';
import { AuthService } from './services/auth.service.js';
import { AuthenticationGuard } from './guards/authentication.guard.js';
import { PasswordChangeGuard } from './guards/password-change.guard.js';
import { AuthorizationGuard } from './guards/authorization.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthRepository, AuthService, PasswordHasherService, AccessTokenService, RefreshTokenService, AuthenticationGuard, PasswordChangeGuard, AuthorizationGuard],
  exports: [AuthRepository, AuthService, PasswordHasherService, AccessTokenService, RefreshTokenService,AuthenticationGuard, PasswordChangeGuard, AuthorizationGuard],
})
export class AuthModule {

}