import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ConfigType } from '@nestjs/config';
import { importPKCS8, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { authConfig } from '../../../../config/namespaces/auth.config.js';
import { AccessTokenService } from '../../services/access-token.service.js';

describe('AccessTokenService', () => {

  let temporaryDirectory: string;

  let privateKeyPath: string;

  let publicKeyPath: string;

  let configuration: ConfigType<typeof authConfig>;

  let accessTokenService: AccessTokenService;

  beforeAll(async () => {

    temporaryDirectory = await mkdtemp(join(tmpdir(), 'access-token-test-'));

    privateKeyPath = join(temporaryDirectory, 'access-private.pem');
    publicKeyPath = join(temporaryDirectory, 'access-public.pem');

    const keyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
    });

    await writeFile(privateKeyPath, keyPair.privateKey, 'utf8');
    await writeFile(publicKeyPath, keyPair.publicKey, 'utf8');

    configuration = {
      accessTokenPrivateKeyPath: privateKeyPath,
      accessTokenPublicKeyPath: publicKeyPath,
      accessTokenIssuer: 'portfolio-api',
      accessTokenAudience: 'portfolio-admin',
      accessTokenTtlSeconds: 900,
      refreshIdleTtlSeconds: 604800,
      refreshFamilyTtlSeconds: 7776000,
      refreshCookieName: 'portfolio_refresh',
      refreshCookiePath: '/admin/auth',
      refreshCookieSecure: false,
      refreshCookieSameSite: 'strict',
      allowedOrigins: ['http://localhost:5173'],
    };

    accessTokenService = new AccessTokenService(configuration);

    await accessTokenService.onModuleInit();

  });

  afterAll(async () => {

    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });

  });

  it('should sign and verify access token', async () => {

    const adminUserId: string = 'admin-user-id';
    const sessionId: string = 'refresh-session-id';

    const accessToken: string = await accessTokenService.signAccessToken(adminUserId, sessionId);

    const payload = await accessTokenService.verifyAccessToken(accessToken);

    expect(payload.sub).toBe(adminUserId);
    expect(payload.sid).toBe(sessionId);
    expect(payload.tokenUse).toBe('access');
    expect(payload.jti.length).toBeGreaterThan(0);
    expect(payload.exp).toBeGreaterThan(payload.iat);

  });

    it('should reject modified token', async () => {

    const accessToken: string = await accessTokenService.signAccessToken('admin-user-id', 'session-id');

    const tokenParts: string[] = accessToken.split('.');

    const signature: string = tokenParts[2];

    const modificationIndex: number = Math.floor(signature.length / 2);

    let replacementCharacter: string = 'A';

    if (signature[modificationIndex] === 'A') {

        replacementCharacter = 'B';

    }

    const modifiedSignature: string =
        signature.slice(0, modificationIndex)
        + replacementCharacter
        + signature.slice(modificationIndex + 1);

    const modifiedToken: string = `${tokenParts[0]}.${tokenParts[1]}.${modifiedSignature}`;

    await expect(accessTokenService.verifyAccessToken(modifiedToken)).rejects.toThrow();

    });

  it('should reject token with wrong issuer', async () => {

    const privateKeyPem: string = await import('node:fs/promises')
      .then(({ readFile }) => readFile(privateKeyPath, 'utf8'));

    const privateKey = await importPKCS8(privateKeyPem, 'RS256');

    const accessToken: string = await new SignJWT({
      sid: 'session-id',
      tokenUse: 'access',
    })
      .setProtectedHeader({
        alg: 'RS256',
        typ: 'JWT',
      })
      .setIssuer('wrong-issuer')
      .setAudience(configuration.accessTokenAudience)
      .setSubject('admin-user-id')
      .setJti('test-jti')
      .setIssuedAt()
      .setExpirationTime('15 minutes')
      .sign(privateKey);

    await expect(accessTokenService.verifyAccessToken(accessToken)).rejects.toThrow();

  });

  it('should reject token with wrong audience', async () => {

    const privateKeyPem: string = await import('node:fs/promises')
      .then(({ readFile }) => readFile(privateKeyPath, 'utf8'));

    const privateKey = await importPKCS8(privateKeyPem, 'RS256');

    const accessToken: string = await new SignJWT({
      sid: 'session-id',
      tokenUse: 'access',
    })
      .setProtectedHeader({
        alg: 'RS256',
        typ: 'JWT',
      })
      .setIssuer(configuration.accessTokenIssuer)
      .setAudience('wrong-audience')
      .setSubject('admin-user-id')
      .setJti('test-jti')
      .setIssuedAt()
      .setExpirationTime('15 minutes')
      .sign(privateKey);

    await expect(accessTokenService.verifyAccessToken(accessToken)).rejects.toThrow();

  });

  it('should reject expired token', async () => {

    const privateKeyPem: string = await import('node:fs/promises')
      .then(({ readFile }) => readFile(privateKeyPath, 'utf8'));

    const privateKey = await importPKCS8(privateKeyPem, 'RS256');

    const accessToken: string = await new SignJWT({
      sid: 'session-id',
      tokenUse: 'access',
    })
      .setProtectedHeader({
        alg: 'RS256',
        typ: 'JWT',
      })
      .setIssuer(configuration.accessTokenIssuer)
      .setAudience(configuration.accessTokenAudience)
      .setSubject('admin-user-id')
      .setJti('test-jti')
      .setIssuedAt()
      .setExpirationTime('0 seconds')
      .sign(privateKey);

    await expect(accessTokenService.verifyAccessToken(accessToken)).rejects.toThrow();

  });

  it('should reject token with invalid tokenUse', async () => {

    const privateKeyPem: string = await import('node:fs/promises')
      .then(({ readFile }) => readFile(privateKeyPath, 'utf8'));

    const privateKey = await importPKCS8(privateKeyPem, 'RS256');

    const accessToken: string = await new SignJWT({
      sid: 'session-id',
      tokenUse: 'refresh',
    })
      .setProtectedHeader({
        alg: 'RS256',
        typ: 'JWT',
      })
      .setIssuer(configuration.accessTokenIssuer)
      .setAudience(configuration.accessTokenAudience)
      .setSubject('admin-user-id')
      .setJti('test-jti')
      .setIssuedAt()
      .setExpirationTime('15 minutes')
      .sign(privateKey);

    await expect(accessTokenService.verifyAccessToken(accessToken)).rejects.toThrow();

  });

});