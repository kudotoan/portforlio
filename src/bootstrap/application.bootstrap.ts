import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module.js';
import { setupValidation } from './setup/setup-validation.js';
import { setupLogger } from './setup/setup-logger.js';
import { setupResponse } from './setup/setup-response.js';
import { setupHelmet } from './setup/setup-helmet.js';
import { startServer } from './setup/start-server.js';
import { setupCors } from './setup/setup-cors.js';
import { setupCookieParser } from './setup/setup-cookie-parser.js';
import { setupOpenApi } from './setup/setup-openapi.js';

export async function bootstrapApplication(): Promise<void> {

  const app: INestApplication = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
 
  setupLogger(app);
  setupValidation(app);
  setupResponse(app);
  setupHelmet(app);
  setupCors(app);
  setupCookieParser(app);
  setupOpenApi(app);
  
  app.enableShutdownHooks();
  await startServer(app);

}