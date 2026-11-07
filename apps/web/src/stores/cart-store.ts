'use client';

import { create } from 'zustand';
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware';

export const CART_STORAGE_KEY = 'pos-cart';

/** Producto mínimo que necesita el carrito para construir una línea. */
export interface CartProduct {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly unitPrice: number;
  readonly stock: number;
}

/** Línea del carrito: snapshot del producto con su cantidad. */
export interface CartItem {
  readonly productId: string;
  readonly sku: string;
  readonly name: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly stock: number;
}

export interface CartState {
  readonly items: CartItem[];
  readonly discountAmount: number;
  addItem: (product: CartProduct, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setDiscount: (amount: number) => void;
  clear: () => void;
}

type CartPersistedState = Pick<CartState, 'items' | 'discountAmount'>;

/** Respaldo en memoria para el SSR: nunca toca `window`. */
const memory = new Map<string, string>();

function createStorage(): StateStorage {
  if (typeof window === 'undefined') {
    return {
      getItem: (name) => memory.get(name) ?? null,
      setItem: (name, value) => {
        memory.set(name, value);
      },
      removeItem: (name) => {
        memory.delete(name);
      },
    };
  }

  return window.localStorage;
}

function toNonNegativeInt(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

/** Recorta la cantidad al rango `[0, stock]`. */
function clampToStock(quantity: number, stock: number): number {
  return Math.min(toNonNegativeInt(quantity), toNonNegativeInt(stock));
}

/** Normaliza el descuento a mayor o igual a 0 y máximo dos decimales. */
function normalizeDiscount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return Math.round(amount * 100) / 100;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      discountAmount: 0,

      addItem: (product, quantity = 1) => {
        const requested = toNonNegativeInt(quantity);
        if (requested <= 0 || product.stock <= 0) {
          return;
        }

        set((state) => {
          const existing = state.items.find(
            (item) => item.productId === product.id,
          );

          if (existing) {
            return {
              items: state.items.map((item) =>
                item.productId === product.id
                  ? {
                      ...item,
                      stock: product.stock,
                      quantity: clampToStock(
                        item.quantity + requested,
                        product.stock,
                      ),
                    }
                  : item,
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                sku: product.sku,
                name: product.name,
                unitPrice: product.unitPrice,
                quantity: clampToStock(requested, product.stock),
                stock: product.stock,
              },
            ],
          };
        });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        }));
      },

      setQuantity: (productId, quantity) => {
        set((state) => ({
          items: state.items
            .map((item) =>
              item.productId === productId
                ? { ...item, quantity: clampToStock(quantity, item.stock) }
                : item,
            )
            .filter((item) => item.quantity > 0),
        }));
      },

      setDiscount: (amount) => {
        set({ discountAmount: normalizeDiscount(amount) });
      },

      clear: () => {
        set({ items: [], discountAmount: 0 });
      },
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage<CartPersistedState>(createStorage),
      partialize: (state): CartPersistedState => ({
        items: state.items,
        discountAmount: state.discountAmount,
      }),
      skipHydration: true,
    },
  ),
);
