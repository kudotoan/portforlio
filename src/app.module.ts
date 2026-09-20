import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigurationModule } from './config/config.module.js';
import { ApplicationLoggerModule } from './common/logger/application-logger.module.js';
import { PrismaModule } from './database/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { RateLimitModule } from './common/rate-limit/rate-limit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';

@Module({
  imports: [
    ConfigurationModule,
    ApplicationLoggerModule,
    PrismaModule,
    HealthModule,
    RateLimitModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
