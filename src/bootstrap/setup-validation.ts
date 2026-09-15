import { INestApplication, ValidationPipe } from '@nestjs/common';

export function setupValidation(application: INestApplication): void {

  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: false,
    validationError: {
      target: false,
      value: false,
    },
  });

  application.useGlobalPipes(validationPipe);

} 