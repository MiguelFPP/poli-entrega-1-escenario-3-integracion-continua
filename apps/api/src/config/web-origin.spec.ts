import { describe, expect, it, jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import { DEFAULT_WEB_ORIGIN, webOrigins } from './web-origin.js';

function createConfig(value: string | undefined) {
  const get = jest.fn<(key: string) => string | undefined>(() => value);

  return { config: { get } as unknown as ConfigService, get };
}

describe('webOrigins', () => {
  it('devuelve un único origen cuando no hay comas', () => {
    const { config, get } = createConfig('http://localhost:4100');

    expect(webOrigins(config)).toEqual(['http://localhost:4100']);
    expect(get).toHaveBeenCalledWith('WEB_ORIGIN');
  });

  it('separa y recorta una lista de orígenes por comas', () => {
    const { config } = createConfig(
      ' http://localhost:4100 , http://panel.local ,https://app.local ',
    );

    expect(webOrigins(config)).toEqual([
      'http://localhost:4100',
      'http://panel.local',
      'https://app.local',
    ]);
  });

  it('descarta los segmentos vacíos de la lista', () => {
    const { config } = createConfig('http://app.local,');

    expect(webOrigins(config)).toEqual(['http://app.local']);
  });

  it('usa el origen por defecto cuando el valor está vacío', () => {
    const { config } = createConfig('');

    expect(webOrigins(config)).toEqual([DEFAULT_WEB_ORIGIN]);
  });

  it('usa el origen por defecto cuando el valor es solo espacios', () => {
    const { config } = createConfig('    ');

    expect(webOrigins(config)).toEqual([DEFAULT_WEB_ORIGIN]);
  });

  it('usa el origen por defecto cuando la variable no está definida', () => {
    const { config } = createConfig(undefined);

    expect(webOrigins(config)).toEqual([DEFAULT_WEB_ORIGIN]);
  });
});
