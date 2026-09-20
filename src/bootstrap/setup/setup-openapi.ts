import type { INestApplication } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { appConfig } from '../../config/namespaces/app.config.js';

export function setupOpenApi(app: INestApplication): void {

  const applicationConfiguration: ConfigType<typeof appConfig> = app.get(appConfig.KEY);

  if (applicationConfiguration.nodeEnvironment === 'production') {

    return;

  }

  const openApiConfiguration = new DocumentBuilder()
    .setTitle('Portfolio Art API')
    .setDescription('API documentation for Portfolio Art')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfiguration);

  SwaggerModule.setup('docs', app, document);

}