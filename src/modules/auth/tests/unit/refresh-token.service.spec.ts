import { describe, expect, it } from 'vitest';

import { RefreshTokenService } from '../../services/refresh-token.service.js';

describe('RefreshTokenService', () => {

  const refreshTokenService: RefreshTokenService = new RefreshTokenService();

  it('should generate refresh token', () => {

    const refreshToken: string = refreshTokenService.generateRefreshToken();

    expect(refreshToken.length).toBeGreaterThan(0);

  });

  it('should generate different refresh tokens', () => {

    const firstRefreshToken: string = refreshTokenService.generateRefreshToken();
    const secondRefreshToken: string = refreshTokenService.generateRefreshToken();

    expect(firstRefreshToken).not.toBe(secondRefreshToken);

  });

  it('should generate base64url refresh token', () => {

    const refreshToken: string = refreshTokenService.generateRefreshToken();

    expect(refreshToken).toMatch(/^[A-Za-z0-9_-]+$/);

  });

  it('should hash refresh token with SHA-256', () => {

    const refreshToken: string = refreshTokenService.generateRefreshToken();
    const refreshTokenHash: string = refreshTokenService.hashRefreshToken(refreshToken);

    expect(refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);

  });

  it('should generate the same hash for the same refresh token', () => {

    const refreshToken: string = refreshTokenService.generateRefreshToken();

    const firstHash: string = refreshTokenService.hashRefreshToken(refreshToken);
    const secondHash: string = refreshTokenService.hashRefreshToken(refreshToken);

    expect(firstHash).toBe(secondHash);

  });

  it('should generate different hashes for different refresh tokens', () => {

    const firstRefreshToken: string = refreshTokenService.generateRefreshToken();
    const secondRefreshToken: string = refreshTokenService.generateRefreshToken();

    const firstHash: string = refreshTokenService.hashRefreshToken(firstRefreshToken);
    const secondHash: string = refreshTokenService.hashRefreshToken(secondRefreshToken);

    expect(firstHash).not.toBe(secondHash);

  });

});