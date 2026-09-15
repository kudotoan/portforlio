import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module.js';

export async function bootstrapApplication(): Promise<void> {
  const app: INestApplication = await NestFactory.create(AppModule);

  const configService: ConfigService = app.get(ConfigService);
  const port: number = configService.getOrThrow<number>('app.port');

  app.enableShutdownHooks();

  await app.listen(port);
}