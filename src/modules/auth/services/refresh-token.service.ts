import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

const REFRESH_TOKEN_BYTES: number = 32;

@Injectable()
export class RefreshTokenService {

  generateRefreshToken(): string {

    const refreshToken: string = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

    return refreshToken;

  }

  hashRefreshToken(refreshToken: string): string {

    const refreshTokenHash: string = createHash('sha256')
      .update(refreshToken, 'utf8')
      .digest('hex');

    return refreshTokenHash;

  }

}