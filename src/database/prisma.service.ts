import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

import { databaseConfig } from '../config/namespaces/database.config.js';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(databaseConfig.KEY) configuration: ConfigType<typeof databaseConfig>) {
    const adapter = new PrismaMariaDb({
      host: configuration.host,
      port: configuration.port,
      user: configuration.user,
      password: configuration.password,
      database: configuration.name,
      connectionLimit: configuration.connectionLimit,
    });

    super({
      adapter: adapter,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}