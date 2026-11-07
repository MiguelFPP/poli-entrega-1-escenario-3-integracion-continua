import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Forma uniforme de error que devuelve la API. */
type ErrorDetail = {
  statusCode: number;
  message: string | string[];
  error: string;
  headers?: Record<string, string>;
};

const INTERNAL_ERROR_MESSAGE = 'Error interno del servidor';

/** Guardia de tipo: objeto plano, sin arrays ni `null`. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Filtro global de excepciones: normaliza toda salida de error a
 * `{ statusCode, message, error, timestamp, path }`, replica las cabeceras de
 * los `HttpException` (por ejemplo `Retry-After` del 429) y nunca filtra el
 * stack de los errores no controlados al cliente.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const detail = this.describe(exception);

    if (detail.headers) {
      for (const [name, value] of Object.entries(detail.headers)) {
        response.setHeader(name, value);
      }
    }

    if (detail.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${detail.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(detail.statusCode).json({
      statusCode: detail.statusCode,
      message: detail.message,
      error: detail.error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  /** Traduce cualquier excepción a la forma uniforme de error. */
  private describe(exception: unknown): ErrorDetail {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: INTERNAL_ERROR_MESSAGE,
        error: this.httpErrorName(HttpStatus.INTERNAL_SERVER_ERROR),
      };
    }

    const statusCode = exception.getStatus();
    const fallbackError = this.httpErrorName(statusCode);
    const payload: unknown = exception.getResponse();

    if (typeof payload === 'string') {
      return { statusCode, message: payload, error: fallbackError };
    }

    if (Array.isArray(payload)) {
      return {
        statusCode,
        message: this.normalizeMessage(payload, exception.message),
        error: fallbackError,
      };
    }

    if (isRecord(payload)) {
      const detail: ErrorDetail = {
        statusCode,
        message: this.normalizeMessage(payload.message, exception.message),
        error:
          typeof payload.error === 'string' && payload.error.length > 0
            ? payload.error
            : fallbackError,
      };

      const headers = this.normalizeHeaders(payload.headers);

      if (headers) {
        detail.headers = headers;
      }

      return detail;
    }

    return {
      statusCode,
      message: this.normalizeMessage(exception.message, INTERNAL_ERROR_MESSAGE),
      error: fallbackError,
    };
  }

  /** Conserva `message` como string o como lista de validación. */
  private normalizeMessage(value: unknown, fallback: string): string | string[] {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    if (Array.isArray(value)) {
      const messages = value.filter(
        (item): item is string => typeof item === 'string',
      );

      return messages.length > 0 ? messages : fallback;
    }

    return fallback;
  }

  /** Solo replica cabeceras con valor string o numérico. */
  private normalizeHeaders(value: unknown): Record<string, string> | undefined {
    if (!isRecord(value)) {
      return undefined;
    }

    const headers: Record<string, string> = {};

    for (const [name, headerValue] of Object.entries(value)) {
      if (typeof headerValue === 'string' || typeof headerValue === 'number') {
        headers[name] = String(headerValue);
      }
    }

    return Object.keys(headers).length > 0 ? headers : undefined;
  }

  /** Nombre legible del error HTTP a partir del código de estado. */
  private httpErrorName(statusCode: number): string {
    const name: string | undefined = HttpStatus[statusCode];

    if (!name) {
      return 'Error';
    }

    return name
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
