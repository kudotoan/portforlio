import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthRepository } from './repositories/auth.repository.js';
import { AccessTokenService } from './services/access-token.service.js';
import { PasswordHasherService } from './services/password-hasher.service.js';
import { RefreshTokenService } from './services/refresh-token.service.js';
import { AuthService } from './services/auth.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthRepository, AuthService, PasswordHasherService, AccessTokenService, RefreshTokenService],
  exports: [AuthRepository, AuthService, PasswordHasherService, AccessTokenService, RefreshTokenService],
})
export class AuthModule {

}