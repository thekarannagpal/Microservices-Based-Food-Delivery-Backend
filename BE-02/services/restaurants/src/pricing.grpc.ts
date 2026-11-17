import { Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { parseTraceparent, QuoteResponseMessage, QuoteRequestMessage, startSpan } from '@nexvia/shared';
import { RestaurantsService } from './restaurants.service';

@Injectable()
export class PricingGrpcController {
  constructor(private readonly restaurants: RestaurantsService) {}

  @GrpcMethod('PricingService', 'CalculateQuote')
  async calculateQuote(data: QuoteRequestMessage): Promise<QuoteResponseMessage> {
    const span = startSpan('grpc.CalculateQuote', parseTraceparent(data.traceparent), 'SERVER', process.env.SERVICE_NAME);
    try {
      const quote = await this.restaurants.getQuote(data.restaurantId, data.items ?? []);
      span.finish({ 'rpc.system': 'grpc', 'rpc.method': 'CalculateQuote', 'rpc.status': quote.error ? 'ERROR' : 'OK' });
      return quote;
    } catch (error) {
      span.finish({ error: true, 'error.message': (error as Error).message });
      return {
        restaurantId: data.restaurantId,
        lines: [],
        subtotal: 0,
        deliveryFee: 0,
        tax: 0,
        total: 0,
        currency: 'INR',
        error: (error as Error).message,
      };
    }
  }
}
