import { Controller, Get, Param, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findAll(@Query('orderId') orderId?: string) {
    return this.notifications.findAll(orderId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.notifications.findById(id);
  }
}
