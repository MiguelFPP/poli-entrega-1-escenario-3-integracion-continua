'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Select, TextField } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useProducts } from '@/lib/catalog';
import type { Product } from '@/lib/catalog';

const SEARCH_DEBOUNCE_MS = 300;

const PAGE_SIZE = 20;

function toOption(product: Product): SelectOption {
  return {
    value: product.id,
    label: `${product.name} · ${product.sku} · stock ${product.stock}`,
  };
}

export interface ProductPickerProps {
  readonly label: string;
  readonly value?: string;
  readonly onChange: (productId: string) => void;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly helperText?: string;
}

export function ProductPicker({
  label,
  value,
  onChange,
  disabled = false,
  error,
  helperText,
}: ProductPickerProps): ReactNode {
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);

  // La búsqueda se aplica con retardo para no pedir en cada tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchText]);

  const productsQuery = useProducts({
    page: 1,
    pageSize: PAGE_SIZE,
    search: search.length > 0 ? search : undefined,
    active: 'true',
    sort: 'name',
    order: 'asc',
  });

  const products = productsQuery.data?.data;

  const handleValueChange = (productId: string): void => {
    const match = products?.find((product) => product.id === productId) ?? null;
    setSelected(match);
    onChange(productId);
  };

  // Conserva la opción elegida aunque los resultados actuales no la incluyan.
  const selectedProduct =
    products?.find((product) => product.id === value) ?? selected;
  const isSelectedVisible =
    products?.some((product) => product.id === value) ?? false;

  const options: SelectOption[] = (products ?? []).map(toOption);
  if (selectedProduct && selectedProduct.id === value && !isSelectedVisible) {
    options.unshift(toOption(selectedProduct));
  }

  const resolvedHelperText = productsQuery.isLoading
    ? 'Cargando productos…'
    : productsQuery.isError
      ? 'No se pudieron cargar los productos.'
      : options.length === 0
        ? 'Sin coincidencias'
        : helperText;

  return (
    <div className="flex flex-col gap-3">
      <TextField
        label="Buscar producto"
        type="search"
        placeholder="Nombre o SKU"
        disabled={disabled}
        value={searchText}
        onChange={setSearchText}
      />

      <Select
        label={label}
        options={options}
        value={value}
        onValueChange={handleValueChange}
        placeholder="Elige un producto"
        disabled={disabled}
        error={error}
        helperText={resolvedHelperText}
      />
    </div>
  );
}
