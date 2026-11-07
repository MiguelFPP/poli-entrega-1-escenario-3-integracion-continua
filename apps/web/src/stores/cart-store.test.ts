import { beforeEach, describe, expect, it } from 'vitest';
import { CART_STORAGE_KEY, useCartStore } from './cart-store';
import type { CartProduct } from './cart-store';

const PRODUCT: CartProduct = {
  id: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  sku: 'BEB-001',
  name: 'Agua Cristal 600 ml',
  unitPrice: 2000,
  stock: 5,
};

const SECOND: CartProduct = {
  id: '8a1f2e3d-4c5b-4a6f-9e0d-1c2b3a4d5e6f',
  sku: 'SNK-001',
  name: 'Papas Margarita Pollo 105 g',
  unitPrice: 3500,
  stock: 10,
};

function resetStore(): void {
  useCartStore.setState({ items: [], discountAmount: 0 });
}

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

describe('useCartStore', () => {
  it('agrega un producto con cantidad 1 por defecto', () => {
    useCartStore.getState().addItem(PRODUCT);

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]?.productId).toBe(PRODUCT.id);
    expect(items[0]?.quantity).toBe(1);
  });

  it('suma la cantidad cuando el producto ya está en el carrito', () => {
    useCartStore.getState().addItem(PRODUCT);
    useCartStore.getState().addItem(PRODUCT, 2);

    expect(useCartStore.getState().items[0]?.quantity).toBe(3);
  });

  it('nunca supera el stock disponible al sumar', () => {
    useCartStore.getState().addItem(PRODUCT, 4);
    useCartStore.getState().addItem(PRODUCT, 4);

    expect(useCartStore.getState().items[0]?.quantity).toBe(PRODUCT.stock);
  });

  it('ignora cantidades no positivas o productos sin stock', () => {
    useCartStore.getState().addItem(PRODUCT, 0);
    useCartStore.getState().addItem({ ...SECOND, stock: 0 });

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('recorta la cantidad a [0, stock] y elimina la línea en 0', () => {
    useCartStore.getState().addItem(PRODUCT, 2);

    useCartStore.getState().setQuantity(PRODUCT.id, 99);
    expect(useCartStore.getState().items[0]?.quantity).toBe(PRODUCT.stock);

    useCartStore.getState().setQuantity(PRODUCT.id, -1);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('elimina una línea con removeItem', () => {
    useCartStore.getState().addItem(PRODUCT);
    useCartStore.getState().addItem(SECOND);

    useCartStore.getState().removeItem(PRODUCT.id);

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]?.productId).toBe(SECOND.id);
  });

  it('normaliza el descuento a mayor o igual a 0 y dos decimales', () => {
    useCartStore.getState().setDiscount(-100);
    expect(useCartStore.getState().discountAmount).toBe(0);

    useCartStore.getState().setDiscount(1234.567);
    expect(useCartStore.getState().discountAmount).toBe(1234.57);
  });

  it('vacía el carrito con clear', () => {
    useCartStore.getState().addItem(PRODUCT);
    useCartStore.getState().setDiscount(500);

    useCartStore.getState().clear();

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.discountAmount).toBe(0);
  });

  it('persiste el carrito bajo la clave pos-cart', () => {
    useCartStore.getState().addItem(PRODUCT);

    const raw = localStorage.getItem(CART_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).toContain(PRODUCT.name);
  });
});
