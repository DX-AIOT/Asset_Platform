import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MoMoGatewayAdapter } from './adapters/momo-gateway.adapter';
import { PAYMENT_GATEWAY } from './interfaces/payment-gateway.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      useClass: MoMoGatewayAdapter,
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentGatewayModule {}
