import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module.js';
import { setupValidation } from './setup-validation.js';
import { setupLogger } from './setup-logger.js';
import { setupResponse } from './setup-response.js';

export async function bootstrapApplication(): Promise<void> {

  const app: INestApplication = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const configService: ConfigService = app.get(ConfigService);
 
  setupLogger(app);
  setupValidation(app);
  setupResponse(app);
  app.enableShutdownHooks();
  
  const port: number = configService.getOrThrow<number>('app.port');
  await app.listen(port);
}