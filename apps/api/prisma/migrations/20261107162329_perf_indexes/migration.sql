-- CreateIndex
CREATE INDEX "products_active_deletedAt_idx" ON "products"("active", "deletedAt");

-- CreateIndex
CREATE INDEX "sales_status_createdAt_idx" ON "sales"("status", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_type_createdAt_idx" ON "stock_movements"("type", "createdAt");
