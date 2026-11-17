import { randomUUID } from 'node:crypto';
import * as amqp from 'amqplib';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { EVENT_EXCHANGE, EventContext } from './events';
import { contextFromCarrier, formatTraceparent, startSpan, Span, TraceContext } from './tracing';

type Handler = (event: EventContext) => Promise<void> | void;

const rabbitUrl = (): string => process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';

async function connectWithRetry(url: string, attempts = 30): Promise<amqp.ChannelModel> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await amqp.connect(url);
    } catch (error) {
      lastError = error;
      console.warn(`[rabbit] connection attempt ${attempt}/${attempts} failed: ${(error as Error).message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}

@Injectable()
export class RabbitClient implements OnModuleDestroy {
  private channelPromise?: Promise<amqp.Channel>;
  private connection?: amqp.ChannelModel;

  private async channel(): Promise<amqp.Channel> {
    if (!this.channelPromise) {
      this.channelPromise = connectWithRetry(rabbitUrl())
        .then((connection) => {
          this.connection = connection;
          return connection.createChannel();
        })
        .then(async (channel) => {
          await channel.assertExchange(EVENT_EXCHANGE, 'topic', { durable: true });
          return channel;
        })
        .catch((error) => {
          this.channelPromise = undefined;
          throw error;
        });
    }
    return this.channelPromise;
  }

  async publish(routingKey: string, payload: object, context?: TraceContext): Promise<void> {
    const channel = await this.channel();
    const correlationId = String((payload as { correlationId?: string }).correlationId ?? randomUUID());
    const envelope = {
      ...payload,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      correlationId,
      traceparent: context ? formatTraceparent(context) : undefined,
    };
    const span = startSpan(`rabbit.publish ${routingKey}`, context, 'PRODUCER');
    const headers: Record<string, string> = { 'x-correlation-id': correlationId };
    if (envelope.traceparent) headers.traceparent = String(envelope.traceparent);
    channel.publish(EVENT_EXCHANGE, routingKey, Buffer.from(JSON.stringify(envelope)), {
      persistent: true,
      contentType: 'application/json',
      headers,
    });
    span.finish({ 'messaging.destination': routingKey, 'messaging.correlation_id': envelope.correlationId });
  }

  async consume(queue: string, routingKeys: string[], handler: Handler): Promise<void> {
    const channel = await this.channel();
    await channel.assertQueue(queue, { durable: true });
    for (const key of routingKeys) await channel.bindQueue(queue, EVENT_EXCHANGE, key);
    await channel.prefetch(10);

    await channel.consume(queue, async (message: amqp.ConsumeMessage | null) => {
      if (!message) return;
      const routingKey = message.fields.routingKey;
      let span: Span | undefined;
      try {
        const payload = JSON.parse(message.content.toString());
        const parent = contextFromCarrier(message.properties.headers as Record<string, string | undefined>);
        span = startSpan(`rabbit.consume ${routingKey}`, parent, 'CONSUMER', process.env.SERVICE_NAME);
        await handler({ payload, context: span.context, routingKey });
        channel.ack(message);
        span.finish({ 'messaging.destination': routingKey, 'messaging.correlation_id': payload.correlationId });
      } catch (error) {
        console.error(`[rabbit] handler failed for ${routingKey}:`, error);
        channel.nack(message, false, false);
        span?.finish({ error: true, 'error.message': (error as Error).message, 'messaging.destination': routingKey });
      }
    });
  }

  async close(): Promise<void> {
    await this.connection?.close();
    this.channelPromise = undefined;
    this.connection = undefined;
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
