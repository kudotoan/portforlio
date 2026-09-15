import { registerAs } from '@nestjs/config';

export type LoggerConfiguration = {
  level: string;
};

export const loggerConfig = registerAs('logger', (): LoggerConfiguration => {
  const level: string = process.env.LOG_LEVEL ?? 'info';

  const configuration: LoggerConfiguration = {
    level: level,
  };

  return configuration;
});