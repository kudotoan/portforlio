import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export function setupCookieParser(application: INestApplication): void {
  application.use(cookieParser());
}