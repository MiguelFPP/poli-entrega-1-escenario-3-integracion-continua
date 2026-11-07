import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service.js';

/** Provee el almacén de rate limit global (en memoria). */
@Global()
@Module({
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
