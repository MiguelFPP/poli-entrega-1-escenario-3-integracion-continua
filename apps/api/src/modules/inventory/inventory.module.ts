import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { ProductStockController } from './product-stock.controller.js';

@Module({
  controllers: [InventoryController, ProductStockController],
  providers: [InventoryService],
})
export class InventoryModule {}
