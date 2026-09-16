import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

export function setupHelmet(application: INestApplication): void {
  application.use(helmet());
}