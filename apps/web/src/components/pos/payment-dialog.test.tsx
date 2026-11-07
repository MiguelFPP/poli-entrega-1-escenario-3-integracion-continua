import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SnackbarProvider } from '@/components/ui';
import { ApiError } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import type { SaleDetail as SaleDetailData } from '@/lib/sales';
import { useCartStore } from '@/stores/cart-store';
import type { CartItem } from '@/stores/cart-store';
import { PaymentDialog } from './payment-dialog';

vi.mock('@/lib/sales', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sales')>();
  return { ...actual, useCreateSale: vi.fn() };
});

const { useCreateSale } = await import('@/lib/sales');

const createSaleMock = vi.mocked(useCreateSale);

const ITEM: CartItem = {
  productId: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  sku: 'BEB-001',
  name: 'Agua Cristal 600 ml',
  unitPrice: 2000,
  quantity: 2,
  stock: 10,
};

const SALE: SaleDetailData = {
  id: '3c4d5e6f-7a8b-4c9d-9e0f-1a2b3c4d5e6f',
  number: 'V-000001',
  status: 'COMPLETED',
  total: 4000,
  itemCount: 1,
  paymentMethod: 'CASH',
  createdAt: '2026-02-12T09:15:00.000Z',
  voidedAt: null,
  user: {
    id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    name: 'Ana Gómez',
    email: 'ana@pos.local',
  },
  subtotal: 4000,
  discountAmount: 0,
  taxAmount: 639,
  costTotal: 2400,
  profit: 961,
  voidReason: null,
  voidedBy: null,
  items: [
    {
      id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f3a4b5c6d',
      productId: ITEM.productId,
      productName: ITEM.name,
      sku: ITEM.sku,
      quantity: ITEM.quantity,
      unitPrice: ITEM.unitPrice,
      unitCost: 1200,
      lineSubtotal: 4000,
      lineDiscount: 0,
      lineTax: 639,
      lineTotal: 4000,
      lineProfit: 961,
    },
  ],
  payment: {
    id: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e',
    method: 'CASH',
    amount: 4000,
    cashReceived: 5000,
    changeGiven: 1000,
    createdAt: '2026-02-12T09:15:00.000Z',
  },
};

function mutationResult<T>(overrides: Record<string, unknown> = {}): T {
  return {
    mutateAsync: vi.fn().mockResolvedValue(SALE),
    isPending: false,
    ...overrides,
  } as unknown as T;
}

/** El normalizador de Testing Library colapsa los espacios; el importe usa NBSP. */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function renderDialog({
  onOpenChange = vi.fn(),
  onCompleted = vi.fn(),
}: {
  onOpenChange?: (open: boolean) => void;
  onCompleted?: (sale: SaleDetailData) => void;
} = {}) {
  return render(
    <SnackbarProvider>
      <PaymentDialog
        open
        onOpenChange={onOpenChange}
        onCompleted={onCompleted}
      />
    </SnackbarProvider>,
  );
}

function chooseCard(): void {
  fireEvent.click(screen.getByRole('combobox', { name: 'Método de pago' }));
  fireEvent.click(screen.getByRole('option', { name: 'Tarjeta' }));
}

function typeCash(value: string): void {
  fireEvent.change(screen.getByLabelText(/Efectivo recibido/), {
    target: { value },
  });
}

function submit(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
}

beforeAll(() => {
  // jsdom no implementa las APIs que Radix usa para posicionar el desplegable.
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;

  Element.prototype.scrollIntoView ??= vi.fn();
});

beforeEach(() => {
  createSaleMock.mockReset();
  createSaleMock.mockReturnValue(
    mutationResult<ReturnType<typeof useCreateSale>>(),
  );
  useCartStore.setState({ items: [ITEM], discountAmount: 0 });
});

describe('PaymentDialog', () => {
  it('en efectivo exige un monto mayor o igual al total y muestra el cambio', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(SALE);
    createSaleMock.mockReturnValue(
      mutationResult<ReturnType<typeof useCreateSale>>({ mutateAsync }),
    );

    renderDialog();

    submit();
    expect(
      await screen.findByText('El efectivo recibido es obligatorio'),
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    typeCash('1000');
    submit();
    expect(
      await screen.findByText(
        'El efectivo recibido debe ser mayor o igual al total',
      ),
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    typeCash('5000');
    expect(await screen.findByText('Cambio')).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatCurrency(1000))),
    ).toBeInTheDocument();
  });

  it('oculta el efectivo y el cambio cuando el pago es con tarjeta', () => {
    renderDialog();

    chooseCard();

    expect(screen.queryByLabelText(/Efectivo recibido/)).not.toBeInTheDocument();
    expect(screen.queryByText('Cambio')).not.toBeInTheDocument();
  });

  it('envía el payload con las líneas, el descuento y el efectivo recibido', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(SALE);
    createSaleMock.mockReturnValue(
      mutationResult<ReturnType<typeof useCreateSale>>({ mutateAsync }),
    );

    renderDialog();

    typeCash('5000');
    submit();

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mutateAsync).toHaveBeenCalledWith({
      items: [{ productId: ITEM.productId, quantity: ITEM.quantity }],
      discountAmount: undefined,
      payment: { method: 'CASH', cashReceived: 5000 },
    });
  });

  it('muestra el error de stock (409) sin cerrar el diálogo', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(
      new ApiError('La operación entra en conflicto con el estado actual.', 409, {
        statusCode: 409,
        error: 'Conflict',
        message: 'Stock insuficiente para BEB-001: disponible 1, solicitado 2',
      }),
    );
    createSaleMock.mockReturnValue(
      mutationResult<ReturnType<typeof useCreateSale>>({ mutateAsync }),
    );

    renderDialog();

    typeCash('5000');
    submit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Stock insuficiente para BEB-001');
    expect(
      screen.getByRole('heading', { name: 'Cobrar venta' }),
    ).toBeInTheDocument();
  });

  it('vacía el carrito y avisa al completar la venta', async () => {
    const onCompleted = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue(SALE);
    createSaleMock.mockReturnValue(
      mutationResult<ReturnType<typeof useCreateSale>>({ mutateAsync }),
    );

    renderDialog({ onCompleted });

    typeCash('5000');
    submit();

    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalledWith(SALE);
    });

    expect(useCartStore.getState().items).toHaveLength(0);
    expect(screen.getAllByText('Venta registrada.').length).toBeGreaterThan(0);
  });
});
