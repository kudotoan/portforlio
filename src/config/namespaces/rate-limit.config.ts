import { registerAs } from '@nestjs/config';

export type RateLimitConfiguration = {

  ttl: number;

  limit: number;

};

export const rateLimitConfig = registerAs('rateLimit', (): RateLimitConfiguration => {

  const configuration: RateLimitConfiguration = {

    ttl: Number(process.env.RATE_LIMIT_TTL_MS),

    limit: Number(process.env.RATE_LIMIT_LIMIT),

  };

  return configuration;

});