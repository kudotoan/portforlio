import { INestApplication } from '@nestjs/common';
import { Logger as PinoNestLogger } from 'nestjs-pino';

export function setupLogger(application: INestApplication): void {
  const logger: PinoNestLogger = application.get(PinoNestLogger);

  application.useLogger(logger);
}