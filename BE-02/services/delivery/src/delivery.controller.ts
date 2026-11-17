import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { TraceContext } from '@nexvia/shared';
import { DeliveryService } from './delivery.service';
import { DeliveryStatus } from './delivery.schema';

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  findAll() {
    return this.delivery.findAll();
  }

  @Get('order/:orderId')
  findByOrderId(@Param('orderId') orderId: string) {
    return this.delivery.findByOrderId(orderId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.delivery.findById(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: DeliveryStatus,
    @Req() req: { traceContext: TraceContext },
  ) {
    return this.delivery.updateStatus(id, status, req.traceContext);
  }
}
