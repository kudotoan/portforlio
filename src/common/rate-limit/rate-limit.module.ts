import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, type ThrottlerModuleOptions } from '@nestjs/throttler';

import { rateLimitConfig } from '../../config/namespaces/rate-limit.config.js';
 
@Module({
  imports: [
    ConfigModule.forFeature(rateLimitConfig),
    ThrottlerModule.forRootAsync({
      imports: [],
      inject: [rateLimitConfig.KEY],
      useFactory: (configuration: ConfigType<typeof rateLimitConfig>): ThrottlerModuleOptions => {

        return [
          {
            ttl: configuration.ttl,
            limit: configuration.limit,
          },
        ];

      },
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class RateLimitModule {}