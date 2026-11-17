import { Module } from '@nestjs/common';
import { RabbitClient } from './rabbit';

@Module({
  providers: [RabbitClient],
  exports: [RabbitClient],
})
export class RabbitModule {}
