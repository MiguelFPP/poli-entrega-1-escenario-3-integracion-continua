import { describe, expect, it } from 'vitest';
import { buildCategoryQuery, buildProductQuery } from './catalog';

describe('buildProductQuery', () => {
  it('devuelve una cadena vacía cuando no hay filtros', () => {
    expect(buildProductQuery({})).toBe('');
  });

  it('omite los parámetros vacíos', () => {
    expect(buildProductQuery({ search: '', categoryId: '' })).toBe('');
  });

  it('serializa la paginación y el orden', () => {
    expect(buildProductQuery({ page: 2, pageSize: 50 })).toBe(
      '?page=2&pageSize=50',
    );
    expect(buildProductQuery({ sort: 'name', order: 'asc' })).toBe(
      '?sort=name&order=asc',
    );
  });

  it('envía los filtros booleanos como cadenas exactas', () => {
    expect(buildProductQuery({ active: 'true', lowStock: 'false' })).toBe(
      '?active=true&lowStock=false',
    );
  });

  it('escapa la búsqueda y la categoría', () => {
    expect(buildProductQuery({ search: 'agua cristal' })).toBe(
      '?search=agua%20cristal',
    );
    expect(buildProductQuery({ categoryId: 'a b&c' })).toBe(
      '?categoryId=a%20b%26c',
    );
  });

  it('no añade parámetros que la API no declara', () => {
    const query = buildProductQuery({ page: 1, search: 'agua' });

    expect(query).not.toContain('pageSize');
    expect(query).not.toContain('sort');
    expect(query).not.toContain('order');
    expect(query).not.toContain('active');
    expect(query).not.toContain('lowStock');
    expect(query).not.toContain('categoryId');
  });
});

describe('buildCategoryQuery', () => {
  it('devuelve una cadena vacía cuando no hay filtros', () => {
    expect(buildCategoryQuery({})).toBe('');
  });

  it('solo admite active y search', () => {
    expect(buildCategoryQuery({ active: 'true', search: 'beb' })).toBe(
      '?active=true&search=beb',
    );
    expect(buildCategoryQuery({ search: '' })).toBe('');
  });
});
