import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp, GLOBAL_PREFIX } from './app.setup.js';

const SWAGGER_PATH = 'api/docs';
const DEFAULT_PORT = 3001;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  configureApp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('POS API')
    .setDescription(
      [
        'API del sistema de punto de venta (POS).',
        '',
        '**Estado: v1.0.0 — cierre técnico.**',
        '',
        'La sesión se mantiene con **cookies `httpOnly`**:',
        '',
        '- `access_token`: JWT HS256 de 15 minutos (cookie de 7 días, `Path=/`).',
        '- `refresh_token`: token opaco de 7 días (cookie con `Path=/api/v1/auth`).',
        '',
        'Los tokens **nunca** viajan en el body de la respuesta. Por eso, para',
        'probar endpoints protegidos desde esta documentación hay que iniciar',
        'sesión con `POST /auth/login` en el mismo navegador (o usar',
        '`Authorization: Bearer <access token>` con el botón **Authorize**).',
        '',
        'Reglas de acceso:',
        '',
        '- Todo requiere autenticación salvo `Health`, `POST /auth/login` y',
        '  `POST /auth/refresh`.',
        '- `/users` exige rol `ADMIN`.',
        '- `/categories` y `/products` exigen rol `ADMIN`.',
        '- `/inventory` exige rol `ADMIN`.',
        '- `/sales` exige rol `ADMIN`.',
        '- `/dashboard` exige rol `ADMIN`.',
        '- `POST /auth/login` acepta 5 intentos por minuto e IP (luego `429`).',
        '- Las mutaciones con cabecera `Origin` distinta de `WEB_ORIGIN` responden',
        '  `403`. Si vas a probar aquí, en `http://localhost:3001`, agrega ese',
        '  origen a `WEB_ORIGIN` (por ejemplo',
        '  `http://localhost:3000,http://localhost:3001`) o usa curl.',
        '',
        `Todas las rutas usan el prefijo global \`/${GLOBAL_PREFIX}\`.`,
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addServer('/', 'Servidor actual')
    .addCookieAuth(
      'access_token',
      {
        type: 'apiKey',
        in: 'cookie',
        description:
          'JWT de acceso emitido por `POST /auth/login` y renovado por `POST /auth/refresh`.',
      },
      'access_token',
    )
    .addCookieAuth(
      'refresh_token',
      {
        type: 'apiKey',
        in: 'cookie',
        description:
          'Token opaco de refresco (7 días), restringido a `/api/v1/auth`.',
      },
      'refresh_token',
    )
    .addTag(
      'Auth',
      'Inicio de sesión, rotación del refresh token, cierre de sesión y perfil.',
    )
    .addTag('Users', 'Administración de usuarios (solo rol `ADMIN`).')
    .addTag(
      'Categories',
      'Catálogo de categorías con borrado lógico (solo rol `ADMIN`).',
    )
    .addTag(
      'Products',
      'Catálogo de productos, precios, stock mínimo e historial de cambios (solo rol `ADMIN`).',
    )
    .addTag(
      'Inventory',
      'Movimientos de stock, costo promedio ponderado, stock bajo y valorización (solo rol ADMIN).',
    )
    .addTag(
      'Sales',
      'Ventas transaccionales, pagos y anulación (solo rol ADMIN).',
    )
    .addTag(
      'Dashboard',
      'KPIs de ventas, tendencia, top de productos, métodos de pago y stock bajo (solo rol ADMIN).',
    )
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
      withCredentials: true,
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
