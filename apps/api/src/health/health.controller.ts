import { Controller, Get, HttpStatus, Logger, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthResponseDto } from './health-response.dto.js';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Estado del servicio',
    description: [
      'Verifica que la API esté en ejecución y que pueda consultar PostgreSQL',
      'mediante `SELECT 1`.',
      '',
      'Público (`@Public()`): lo consume Docker Compose, el balanceador y las',
      'herramientas de monitoreo, por lo que no requiere cookies ni Bearer.',
      '',
      'Devuelve **200** cuando la base de datos responde y **503** cuando no.',
    ].join('\n'),
  })
  @ApiOkResponse({
    description: 'El servicio y la base de datos están operativos.',
    type: HealthResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description:
      'La API está en ejecución pero no pudo consultar PostgreSQL (`database: down`).',
    type: HealthResponseDto,
  })
  async check(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthResponseDto> {
    const databaseUp = await this.prisma.isHealthy();

    if (!databaseUp) {
      this.logger.warn('Health check degradado: PostgreSQL no responde');
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: databaseUp ? 'ok' : 'error',
      database: databaseUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
  }
}
