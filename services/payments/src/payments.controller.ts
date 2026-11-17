import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { TraceContext } from '@nexvia/shared';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  findAll(@Query('orderId') orderId?: string) {
    return this.payments.findAll(orderId);
  }

  @Get('order/:orderId')
  findByOrderId(@Param('orderId') orderId: string) {
    return this.payments.findByOrderId(orderId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.payments.findById(id);
  }

  @Post(':orderId/refund')
  refund(
    @Param('orderId') orderId: string,
    @Body('reason') reason: string,
    @Req() req: { traceContext: TraceContext },
  ) {
    return this.payments.requestRefund(orderId, reason ?? 'Manual refund', req.traceContext);
  }
}
