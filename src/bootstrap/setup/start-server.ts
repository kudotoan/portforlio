import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export async function startServer(app: INestApplication): Promise<void> {

  const configService: ConfigService = app.get(ConfigService);
  const port: number = configService.getOrThrow<number>('app.port');

  await app.listen(port);
}