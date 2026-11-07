import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

const GLOBAL_PREFIX = 'api/v1';
const SWAGGER_PATH = 'api/docs';
const DEFAULT_PORT = 3001;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix(GLOBAL_PREFIX);

  // CSP deshabilitada porque Swagger UI usa estilos y scripts inline.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('POS API')
    .setDescription(
      [
        'API del sistema de punto de venta (POS).',
        '',
        'Esta documentación cubre la Fase 0 (bootstrap): únicamente expone el',
        'endpoint de salud que verifica el servicio y su conexión con PostgreSQL.',
        'Los módulos de autenticación, productos, inventario, ventas y KPIs se',
        'agregarán en fases posteriores.',
        '',
        `Todas las rutas usan el prefijo global \`/${GLOBAL_PREFIX}\`.`,
      ].join('\n'),
    )
    .setVersion('0.1.0')
    .addServer('/', 'Servidor actual')
    .addTag(
      'Health',
      'Estado del servicio y de la base de datos (sin autenticación).',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: 'POS API — Documentación',
    swaggerOptions: {
      displayRequestDuration: true,
      persistAuthorization: true,
    },
    jsonDocumentUrl: `${SWAGGER_PATH}/json`,
  });

  app.enableShutdownHooks();

  const port = config.get<number>('PORT') ?? DEFAULT_PORT;
  await app.listen(port, '0.0.0.0');

  logger.log(`API disponible en http://localhost:${port}/${GLOBAL_PREFIX}`);
  logger.log(`Swagger disponible en http://localhost:${port}/${SWAGGER_PATH}`);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(
    'No se pudo iniciar la aplicación',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
