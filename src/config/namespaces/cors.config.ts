import { registerAs } from '@nestjs/config';

export type CorsConfiguration = {
  origin: string;
};

export const corsConfig = registerAs('cors', (): CorsConfiguration => {
  const origin: string = process.env.CORS_ORIGIN ?? '';

  const configuration: CorsConfiguration = {
    origin: origin,
  };

  return configuration;
});