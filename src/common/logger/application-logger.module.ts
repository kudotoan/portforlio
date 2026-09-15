import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Params } from 'nestjs-pino';

import { loggerConfig } from '../../config/namespaces/logger.config.js';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [loggerConfig.KEY],

      useFactory: (configuration: ConfigType<typeof loggerConfig>): Params => {
        return {
          pinoHttp: {
            level: configuration.level,
            autoLogging: true,

            genReqId: (): string => {
              const requestId: string = randomUUID();

              return requestId;
            },

            redact: {
              paths: [
                'req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]',
                'req.body.password', 'req.body.currentPassword', 'req.body.newPassword',
              ],
              censor: '[REDACTED]',
            },
          },
        };
      },
    }),
  ],
})
export class ApplicationLoggerModule {
}