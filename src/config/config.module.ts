import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { appConfig } from './namespaces/app.config.js';
import { environmentValidationSchema } from './validation/environment.validation.js';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: environmentValidationSchema,
    }),
  ],
})
export class ConfigurationModule {
}