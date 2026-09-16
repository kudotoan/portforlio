import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { appConfig } from './namespaces/app.config.js';
import { environmentValidationSchema } from './validation/environment.validation.js';
import { loggerConfig } from './namespaces/logger.config.js';
import { corsConfig } from './namespaces/cors.config.js';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, loggerConfig, corsConfig],
      validationSchema: environmentValidationSchema,
    }),
  ],
})
export class ConfigurationModule {
}