import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { TraceContext } from '@nexvia/shared';
import { CancelOrderDto, CreateOrderDto } from './dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @Req() req: { traceContext: TraceContext }) {
    return this.orders.create(dto, req.traceContext);
  }

  @Get()
  findAll(@Query('customerId') customerId?: string) {
    return this.orders.findAll(customerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orders.findById(id);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @Req() req: { traceContext: TraceContext },
  ) {
    return this.orders.cancel(id, dto, req.traceContext);
  }
}
