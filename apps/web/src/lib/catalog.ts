'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ApiError, apiFetch } from './api-client';

/** Resumen de la categoría embebido en un producto. */
export interface ProductCategoryRef {
  readonly id: string;
  readonly name: string;
}

/** Producto del catálogo. */
export interface Product {
  readonly id: string;
  readonly sku: string;
  readonly barcode: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly categoryId: string;
  readonly category: ProductCategoryRef;
  readonly costPrice: number;
  readonly salePrice: number;
  readonly stock: number;
  readonly minStock: number;
  readonly unit: string;
  readonly imageUrl: string | null;
  readonly active: boolean;
  readonly lowStock: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Categoría del catálogo. */
export interface Category {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly productCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Campo de precio modificado en el historial. */
export type PriceHistoryField = 'COST' | 'SALE';

/** Usuario que registró un cambio de precio. */
export interface PriceHistoryChangedBy {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** Cambio de precio registrado. */
export interface PriceHistoryEntry {
  readonly id: string;
  readonly productId: string;
  readonly field: PriceHistoryField;
  readonly oldValue: number;
  readonly newValue: number;
  readonly changedBy: PriceHistoryChangedBy | null;
  readonly createdAt: string;
}

/** Metadatos de paginación de un listado. */
export interface PaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

/** Envoltura paginada de la API. */
export interface Paginated<T> {
  readonly data: T[];
  readonly meta: PaginationMeta;
}

export type ProductSortField = 'name' | 'salePrice' | 'stock' | 'createdAt';

export type SortOrder = 'asc' | 'desc';

/** Filtros, orden y paginación del listado de productos. */
export interface ProductQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly search?: string;
  readonly categoryId?: string;
  readonly active?: 'true' | 'false';
  readonly lowStock?: 'true' | 'false';
  readonly sort?: ProductSortField;
  readonly order?: SortOrder;
}

/** Filtros del listado de categorías. */
export interface CategoryQuery {
  readonly active?: 'true' | 'false';
  readonly search?: string;
}

const PRODUCT_SORT_FIELDS: readonly ProductSortField[] = [
  'name',
  'salePrice',
  'stock',
  'createdAt',
];

/** La API rechaza los parámetros desconocidos: solo se envía lo que hay. */
function isPresent(value: string | undefined): value is string {
  return value !== undefined && value !== '';
}

/** Convierte el valor de un filtro booleano a la cadena que espera la API. */
export function toBooleanFlag(value: string): 'true' | 'false' | undefined {
  if (value === 'true') {
    return 'true';
  }
  if (value === 'false') {
    return 'false';
  }
  return undefined;
}

/** Serializa los filtros de productos; omite los vacíos. */
export function buildProductQuery(query: ProductQuery): string {
  const parts: string[] = [];

  if (query.page !== undefined) {
    parts.push(`page=${query.page}`);
  }
  if (query.pageSize !== undefined) {
    parts.push(`pageSize=${query.pageSize}`);
  }
  if (isPresent(query.search)) {
    parts.push(`search=${encodeURIComponent(query.search)}`);
  }
  if (isPresent(query.categoryId)) {
    parts.push(`categoryId=${encodeURIComponent(query.categoryId)}`);
  }
  if (query.active) {
    parts.push(`active=${query.active}`);
  }
  if (query.lowStock) {
    parts.push(`lowStock=${query.lowStock}`);
  }
  if (query.sort) {
    parts.push(`sort=${query.sort}`);
  }
  if (query.order) {
    parts.push(`order=${query.order}`);
  }

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** Serializa los filtros de categorías; solo admite `active` y `search`. */
export function buildCategoryQuery(query: CategoryQuery): string {
  const parts: string[] = [];

  if (query.active) {
    parts.push(`active=${query.active}`);
  }
  if (isPresent(query.search)) {
    parts.push(`search=${encodeURIComponent(query.search)}`);
  }

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** Claves de consulta del catálogo, para invalidar y preobtener. */
export const productKeys = {
  all: ['products'] as const,
  list: (query: ProductQuery) => ['products', query] as const,
  detail: (id: string) => ['products', id] as const,
};

export const categoryKeys = {
  all: ['categories'] as const,
  list: (query: CategoryQuery) => ['categories', query] as const,
};

export const priceHistoryKeys = {
  all: ['price-history'] as const,
  detail: (id: string) => ['price-history', id] as const,
  page: (id: string, page: number, pageSize: number) =>
    ['price-history', id, page, pageSize] as const,
};

/** Campos del catálogo que se envían al crear o actualizar un producto. */
export interface ProductPayload {
  readonly sku: string;
  readonly barcode?: string;
  readonly name: string;
  readonly description?: string;
  readonly categoryId: string;
  readonly costPrice: number;
  readonly salePrice: number;
  readonly minStock?: number;
  readonly unit?: string;
  readonly imageUrl?: string;
  readonly active?: boolean;
}

/** Campos que se envían al crear o actualizar una categoría. */
export interface CategoryPayload {
  readonly name: string;
  readonly description?: string;
  readonly active?: boolean;
}

/** Listado paginado de productos. */
export function useProducts(query: ProductQuery) {
  return useQuery({
    queryKey: productKeys.list(query),
    queryFn: () =>
      apiFetch<Paginated<Product>>(`/products${buildProductQuery(query)}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/**
 * Detalle de un producto; un 404 se resuelve como `null`.
 *
 * TanStack Query v5 no admite `undefined` como resultado de una consulta
 * (lanza "Query data cannot be undefined"), así que el "no existe" se
 * representa con `null`.
 */
export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: productKeys.detail(id ?? ''),
    queryFn: async (): Promise<Product | null> => {
      try {
        return await apiFetch<Product>(`/products/${id}`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/** Listado de categorías (la API no lo pagina). */
export function useCategories(query: CategoryQuery = {}) {
  return useQuery({
    queryKey: categoryKeys.list(query),
    queryFn: () =>
      apiFetch<Category[]>(`/categories${buildCategoryQuery(query)}`),
    staleTime: 30_000,
  });
}

export interface SetProductActiveVariables {
  readonly id: string;
  readonly active: boolean;
}

/** Activa o desactiva un producto y refresca el catálogo. */
export function useSetProductActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, active }: SetProductActiveVariables) =>
      apiFetch<Product>(`/products/${id}`, {
        method: 'PATCH',
        json: { active },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

/** Historial de precios de un producto, paginado. */
export function usePriceHistory(
  id: string | undefined,
  page: number,
  pageSize: number,
) {
  return useQuery({
    queryKey: priceHistoryKeys.page(id ?? '', page, pageSize),
    queryFn: () =>
      apiFetch<Paginated<PriceHistoryEntry>>(
        `/products/${id}/price-history?page=${page}&pageSize=${pageSize}`,
      ),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Crea un producto y refresca el catálogo y el conteo de categorías. */
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProductPayload) =>
      apiFetch<Product>('/products', { method: 'POST', json: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

/** Actualiza un producto y refresca su detalle, su historial y el catálogo. */
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      readonly id: string;
      readonly payload: Partial<ProductPayload>;
    }) =>
      apiFetch<Product>(`/products/${id}`, { method: 'PATCH', json: payload }),
    onSuccess: (_product, variables) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      void queryClient.invalidateQueries({
        queryKey: productKeys.detail(variables.id),
      });
      void queryClient.invalidateQueries({
        queryKey: priceHistoryKeys.detail(variables.id),
      });
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

/** Elimina un producto (borrado lógico) y refresca el catálogo. */
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

/** Crea una categoría y refresca el listado. */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CategoryPayload) =>
      apiFetch<Category>('/categories', { method: 'POST', json: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

/** Actualiza una categoría y refresca el listado. */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      readonly id: string;
      readonly payload: Partial<CategoryPayload>;
    }) =>
      apiFetch<Category>(`/categories/${id}`, {
        method: 'PATCH',
        json: payload,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

/** Desactiva una categoría (borrado lógico) y refresca el listado. */
export function useDeactivateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Category>(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

/** Ordena el campo de una opción `campo:dirección`. */
export function parseSortOption(
  value: string,
): { sort: ProductSortField; order: SortOrder } | undefined {
  const [field, direction] = value.split(':');
  const sort = PRODUCT_SORT_FIELDS.find((candidate) => candidate === field);

  if (!sort) {
    return undefined;
  }

  return { sort, order: direction === 'asc' ? 'asc' : 'desc' };
}
