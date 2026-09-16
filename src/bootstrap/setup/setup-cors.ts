import { INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { corsConfig } from '../../config/namespaces/cors.config.js';

export function setupCors(application: INestApplication): void {
  const configuration: ConfigType<typeof corsConfig> = application.get(corsConfig.KEY);

  application.enableCors({
    origin: configuration.origin,
    credentials: true,
  });
}