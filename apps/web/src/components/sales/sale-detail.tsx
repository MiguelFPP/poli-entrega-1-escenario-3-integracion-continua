'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { SaleTotals } from '@/components/pos/sale-totals';
import {
  Button,
  Chip,
  EmptyState,
  Icon,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import type { ChipVariant } from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/lib/format';
import {
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
  useSale,
  useVoidSale,
} from '@/lib/sales';
import type { SaleStatus } from '@/lib/sales';
import { VoidSaleDialog } from './void-sale-dialog';

const STATUS_VARIANTS: Record<SaleStatus, ChipVariant> = {
  COMPLETED: 'assist',
  VOIDED: 'filter',
};

function DetailRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-on-surface-variant uppercase">
        {label}
      </dt>
      <dd className="text-sm text-on-surface">{children}</dd>
    </div>
  );
}

export interface SaleDetailProps {
  readonly saleId: string;
  readonly isNew?: boolean;
}

export function SaleDetail({
  saleId,
  isNew = false,
}: SaleDetailProps): ReactNode {
  const saleQuery = useSale(saleId);
  const voidSale = useVoidSale();
  const [voidOpen, setVoidOpen] = useState(false);

  if (saleQuery.isLoading) {
    return (
      <section
        role="status"
        aria-label="Cargando venta"
        className="flex flex-col gap-4 rounded-3xl bg-surface-container p-6"
      >
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-32 w-full" />
      </section>
    );
  }

  if (saleQuery.isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-3xl border border-error bg-surface-container-low p-6"
      >
        <h1 className="text-lg font-semibold text-on-surface">
          No se pudo cargar la venta
        </h1>
        <p className="text-sm text-on-surface-variant">
          {extractErrorMessage(saleQuery.error)}
        </p>
        <Button
          variant="outlined"
          onClick={() => {
            void saleQuery.refetch();
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  const sale = saleQuery.data;

  // `null` significa que la API respondió 404: la venta no existe.
  if (sale === null) {
    return (
      <EmptyState
        icon={<Icon name="sales" />}
        title="Venta no encontrada"
        description="La venta no existe o fue eliminada del historial."
      />
    );
  }

  // `undefined` es el estado de carga inicial de la consulta.
  if (!sale) {
    return (
      <section
        role="status"
        aria-label="Cargando venta"
        className="flex flex-col gap-4 rounded-3xl bg-surface-container p-6"
      >
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-32 w-full" />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-on-surface">
              {sale.number}
            </h1>
            <Chip
              label={SALE_STATUS_LABELS[sale.status]}
              variant={STATUS_VARIANTS[sale.status]}
            />
          </div>
          <p className="text-sm text-on-surface-variant">
            {`${formatDateTime(sale.createdAt)} · ${sale.user.name}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outlined"
            onClick={() => {
              window.print();
            }}
          >
            Imprimir comprobante
          </Button>
          {sale.status === 'COMPLETED' ? (
            <Button
              variant="danger"
              disabled={voidSale.isPending}
              onClick={() => {
                setVoidOpen(true);
              }}
            >
              Anular venta
            </Button>
          ) : null}
        </div>
      </header>

      {isNew ? (
        <p
          role="status"
          className="rounded-2xl border border-primary bg-surface-container-low px-4 py-3 text-sm text-on-surface"
        >
          Venta registrada correctamente.
        </p>
      ) : null}

      <Table>
        <TableCaption>Líneas de la venta</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Descuento</TableHead>
            <TableHead>IVA</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Ganancia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sale.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-on-surface">
                    {item.productName}
                  </span>
                  <span className="font-mono text-xs text-on-surface-variant">
                    {item.sku}
                  </span>
                </div>
              </TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
              <TableCell>{formatCurrency(item.lineDiscount)}</TableCell>
              <TableCell>{formatCurrency(item.lineTax)}</TableCell>
              <TableCell>{formatCurrency(item.lineTotal)}</TableCell>
              <TableCell>{formatCurrency(item.lineProfit)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <SaleTotals
        subtotal={sale.subtotal}
        discountAmount={sale.discountAmount}
        taxAmount={sale.taxAmount}
        total={sale.total}
        itemCount={sale.itemCount}
      />

      <section className="flex flex-col gap-3 rounded-3xl border border-outline-variant bg-surface p-6">
        <h2 className="text-lg font-semibold text-on-surface">Pago</h2>
        {sale.payment ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailRow label="Método">
              {PAYMENT_METHOD_LABELS[sale.payment.method]}
            </DetailRow>
            <DetailRow label="Monto">
              {formatCurrency(sale.payment.amount)}
            </DetailRow>
            <DetailRow label="Efectivo recibido">
              {sale.payment.cashReceived !== null
                ? formatCurrency(sale.payment.cashReceived)
                : '—'}
            </DetailRow>
            <DetailRow label="Cambio">
              {sale.payment.changeGiven !== null
                ? formatCurrency(sale.payment.changeGiven)
                : '—'}
            </DetailRow>
          </dl>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Sin pago registrado.
          </p>
        )}
      </section>

      {sale.status === 'VOIDED' ? (
        <section className="flex flex-col gap-3 rounded-3xl border border-error bg-surface-container-low p-6">
          <h2 className="text-lg font-semibold text-on-surface">Anulación</h2>
          <dl className="grid gap-4 sm:grid-cols-3">
            <DetailRow label="Motivo">{sale.voidReason ?? '—'}</DetailRow>
            <DetailRow label="Fecha">
              {sale.voidedAt ? formatDateTime(sale.voidedAt) : '—'}
            </DetailRow>
            <DetailRow label="Usuario">{sale.voidedBy?.name ?? '—'}</DetailRow>
          </dl>
        </section>
      ) : null}

      <VoidSaleDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        saleId={sale.id}
      />
    </section>
  );
}
