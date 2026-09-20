import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from 'jose';

import { authConfig } from '../../../config/namespaces/auth.config.js';
import type { AccessTokenPayload } from '../types/access-token-payload.type.js';

const ACCESS_TOKEN_ALGORITHM: string = 'RS256';
const ACCESS_TOKEN_TYPE: string = 'JWT';
const ACCESS_TOKEN_USE: string = 'access';

@Injectable()
export class AccessTokenService implements OnModuleInit {

  private accessTokenPrivateKey: Awaited<ReturnType<typeof importPKCS8>> | null = null;

  private accessTokenPublicKey: Awaited<ReturnType<typeof importSPKI>> | null = null;

  constructor(@Inject(authConfig.KEY) private readonly configuration: ConfigType<typeof authConfig>) {

  }

  async onModuleInit(): Promise<void> {

    const privateKeyPath: string = resolve(process.cwd(), this.configuration.accessTokenPrivateKeyPath);
    const publicKeyPath: string = resolve(process.cwd(), this.configuration.accessTokenPublicKeyPath);

    const privateKeyPem: string = await readFile(privateKeyPath, 'utf8');
    const publicKeyPem: string = await readFile(publicKeyPath, 'utf8');

    this.accessTokenPrivateKey = await importPKCS8(privateKeyPem, ACCESS_TOKEN_ALGORITHM);
    this.accessTokenPublicKey = await importSPKI(publicKeyPem, ACCESS_TOKEN_ALGORITHM);

    await this.validateKeyPair();

  }

  async signAccessToken(adminUserId: string, refreshTokenSessionId: string): Promise<string> {

    const privateKey: Awaited<ReturnType<typeof importPKCS8>> = this.getAccessTokenPrivateKey();

    const issuedAt: number = Math.floor(Date.now() / 1000);
    const expiresAt: number = issuedAt + this.configuration.accessTokenTtlSeconds;

    const accessToken: string = await new SignJWT({
      sid: refreshTokenSessionId,
      tokenUse: ACCESS_TOKEN_USE,
    })
      .setProtectedHeader({
        alg: ACCESS_TOKEN_ALGORITHM,
        typ: ACCESS_TOKEN_TYPE,
      })
      .setIssuer(this.configuration.accessTokenIssuer)
      .setAudience(this.configuration.accessTokenAudience)
      .setSubject(adminUserId)
      .setJti(randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(privateKey);

    return accessToken;

  }

  async verifyAccessToken(accessToken: string): Promise<AccessTokenPayload> {

    const publicKey: Awaited<ReturnType<typeof importSPKI>> = this.getAccessTokenPublicKey();

    const verificationResult = await jwtVerify(accessToken, publicKey, {
      algorithms: [ACCESS_TOKEN_ALGORITHM],
      issuer: this.configuration.accessTokenIssuer,
      audience: this.configuration.accessTokenAudience,
      typ: ACCESS_TOKEN_TYPE,
      requiredClaims: ['sub', 'sid', 'jti', 'iat', 'exp', 'tokenUse'],
    });

    const payload = verificationResult.payload;

    if (
      typeof payload.sub !== 'string'
      || typeof payload.sid !== 'string'
      || typeof payload.jti !== 'string'
      || typeof payload.iat !== 'number'
      || typeof payload.exp !== 'number'
      || payload.tokenUse !== ACCESS_TOKEN_USE
    ) {

      throw new Error('Invalid access token payload.');

    }

    const accessTokenPayload: AccessTokenPayload = {

      sub: payload.sub,

      sid: payload.sid,

      jti: payload.jti,

      tokenUse: 'access',

      iat: payload.iat,

      exp: payload.exp,

    };

    return accessTokenPayload;

  }

  private getAccessTokenPrivateKey(): Awaited<ReturnType<typeof importPKCS8>> {

    if (this.accessTokenPrivateKey === null) {

      throw new Error('Access token private key is not initialized.');

    }

    return this.accessTokenPrivateKey;

  }

  private getAccessTokenPublicKey(): Awaited<ReturnType<typeof importSPKI>> {

    if (this.accessTokenPublicKey === null) {

      throw new Error('Access token public key is not initialized.');

    }

    return this.accessTokenPublicKey;

  }

  private async validateKeyPair(): Promise<void> {

    const privateKey: Awaited<ReturnType<typeof importPKCS8>> = this.getAccessTokenPrivateKey();
    const publicKey: Awaited<ReturnType<typeof importSPKI>> = this.getAccessTokenPublicKey();

    const validationToken: string = await new SignJWT({})
      .setProtectedHeader({
        alg: ACCESS_TOKEN_ALGORITHM,
        typ: ACCESS_TOKEN_TYPE,
      })
      .setIssuedAt()
      .setExpirationTime('1 minute')
      .sign(privateKey);

    await jwtVerify(validationToken, publicKey, {
      algorithms: [ACCESS_TOKEN_ALGORITHM],
      typ: ACCESS_TOKEN_TYPE,
    });

  }

}