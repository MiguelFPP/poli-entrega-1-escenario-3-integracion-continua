'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { InventoryAdjustment } from '@/components/inventory/inventory-adjustment';
import { InventorySummary } from '@/components/inventory/inventory-summary';
import { LowStock } from '@/components/inventory/low-stock';
import { StockMovements } from '@/components/inventory/stock-movements';
import { Button, Icon } from '@/components/ui';

export default function InventoryPage(): ReactNode {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-on-surface">Inventario</h1>
          <p className="text-sm text-on-surface-variant">
            Stock disponible, alertas de reposición y movimientos registrados.
          </p>
        </div>
        <Button
          onClick={() => {
            setDialogOpen(true);
          }}
        >
          <Icon name="add" size="size-4" />
          Nuevo movimiento
        </Button>
      </header>

      <div className="flex flex-col gap-6">
        <InventorySummary />
        <LowStock />
        <StockMovements />

        <InventoryAdjustment open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>
    </section>
  );
}
