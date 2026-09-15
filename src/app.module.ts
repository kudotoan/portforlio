import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigurationModule } from './config/config.module.js';
import { ApplicationLoggerModule } from './common/logger/application-logger.module.js';

@Module({
  imports: [
    ConfigurationModule,
    ApplicationLoggerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
