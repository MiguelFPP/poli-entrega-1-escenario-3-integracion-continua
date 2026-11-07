import { ApiProperty } from '@nestjs/swagger';

/** Forma estándar de error de NestJS, reutilizada en Swagger. */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'Código HTTP de la respuesta.',
    example: 401,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Nombre corto del error HTTP.',
    example: 'Unauthorized',
  })
  error!: string;

  @ApiProperty({
    description:
      'Mensaje o lista de mensajes. Con el `ValidationPipe` global es un arreglo.',
    oneOf: [
      { type: 'string', example: 'Credenciales inválidas' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['password debe tener al menos 8 caracteres'],
      },
    ],
  })
  message!: string | string[];

  @ApiProperty({
    description: 'Marca temporal ISO 8601 en la que se generó el error.',
    format: 'date-time',
    example: '2026-01-15T12:00:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'Ruta de la petición que originó el error.',
    example: '/api/v1/products',
  })
  path!: string;
}
