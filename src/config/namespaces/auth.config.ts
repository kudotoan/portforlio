import { registerAs } from '@nestjs/config';

export type RefreshCookieSameSite = 'strict' | 'lax' | 'none';

export type AuthConfiguration = {

  accessTokenPrivateKeyPath: string;

  accessTokenPublicKeyPath: string;

  accessTokenIssuer: string;

  accessTokenAudience: string;

  accessTokenTtlSeconds: number;

  refreshIdleTtlSeconds: number;

  refreshFamilyTtlSeconds: number;

  refreshCookieName: string;

  refreshCookiePath: string;

  refreshCookieSecure: boolean;

  refreshCookieSameSite: RefreshCookieSameSite;

  allowedOrigins: string[];

};

function parseAllowedOrigins(value: string): string[] {

  const origins: string[] = value
    .split(',')
    .map((origin: string): string => origin.trim())
    .filter((origin: string): boolean => origin.length > 0);

  return origins;

}

export const authConfig = registerAs('auth', (): AuthConfiguration => {

  const configuration: AuthConfiguration = {

    accessTokenPrivateKeyPath: process.env.JWT_ACCESS_PRIVATE_KEY_PATH ?? '',

    accessTokenPublicKeyPath: process.env.JWT_ACCESS_PUBLIC_KEY_PATH ?? '',

    accessTokenIssuer: process.env.JWT_ACCESS_ISSUER ?? '',

    accessTokenAudience: process.env.JWT_ACCESS_AUDIENCE ?? '',

    accessTokenTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS),

    refreshIdleTtlSeconds: Number(process.env.REFRESH_IDLE_TTL_SECONDS),

    refreshFamilyTtlSeconds: Number(process.env.REFRESH_FAMILY_TTL_SECONDS),

    refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? '',

    refreshCookiePath: process.env.REFRESH_COOKIE_PATH ?? '/admin/auth',

    refreshCookieSecure: process.env.REFRESH_COOKIE_SECURE === 'true',

    refreshCookieSameSite: (process.env.REFRESH_COOKIE_SAME_SITE ?? 'strict') as RefreshCookieSameSite,

    allowedOrigins: parseAllowedOrigins(process.env.AUTH_ALLOWED_ORIGINS ?? ''),

  };

  return configuration;

});