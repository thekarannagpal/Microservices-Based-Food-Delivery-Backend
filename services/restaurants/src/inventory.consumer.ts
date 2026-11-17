import { Injectable, OnModuleInit } from '@nestjs/common';
import { childContext, OrderPlacedEvent, RabbitClient, RoutingKey, StockReservationFailedEvent, StockReservedEvent } from '@nexvia/shared';
import { RestaurantsService } from './restaurants.service';

@Injectable()
export class InventoryConsumer implements OnModuleInit {
  constructor(private readonly rabbit: RabbitClient, private readonly restaurants: RestaurantsService) {}

  async onModuleInit() {
    await this.rabbit.consume('restaurants.inventory', [RoutingKey.OrderPlaced], async ({ payload, context }) => {
      const event = payload as OrderPlacedEvent;
      const result = await this.restaurants.reserveStock(event.orderId, event.restaurantId, event.items);
      if (result.alreadyProcessed) return;

      const producerContext = childContext(context);
      if (result.ok) {
        const reserved: StockReservedEvent = {
          eventId: '',
          occurredAt: new Date().toISOString(),
          correlationId: event.correlationId,
          orderId: event.orderId,
          restaurantId: event.restaurantId,
        };
        await this.rabbit.publish(RoutingKey.StockReserved, reserved, producerContext);
        return;
      }

      const failed: StockReservationFailedEvent = {
        eventId: '',
        occurredAt: new Date().toISOString(),
        correlationId: event.correlationId,
        orderId: event.orderId,
        restaurantId: event.restaurantId,
        reason: result.reason ?? 'Stock reservation failed',
      };
      await this.rabbit.publish(RoutingKey.StockReservationFailed, failed, producerContext);
    });
  }
}
