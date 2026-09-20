import { Controller, Get } from '@nestjs/common';

import { HealthService, type HealthResult } from './health.service.js';

@Controller('health')
export class HealthController {

  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(): Promise<HealthResult> {

    return this.healthService.getReadiness();

  }

  @Get('live')
  getLiveness(): HealthResult {

    return this.healthService.getLiveness();

  }

  @Get('ready')
  async getReadiness(): Promise<HealthResult> {

    return this.healthService.getReadiness();

  }

}