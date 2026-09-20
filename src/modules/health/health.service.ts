import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';

export type HealthResult = {
  status: 'ok';
};

@Injectable()
export class HealthService {

  constructor(private readonly prismaService: PrismaService) {}

  getLiveness(): HealthResult {

    return {
      status: 'ok',
    };

  }

  async getReadiness(): Promise<HealthResult> {

    try {

      await this.prismaService.$queryRaw`SELECT 1`;

    } catch {

      throw new ServiceUnavailableException('Database is unavailable');

    }

    return {
      status: 'ok',
    };

  }

}