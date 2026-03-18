import amqplib, { Channel, ChannelModel } from 'amqplib';
import { config } from './config.js';

export const QUEUE_NAME = 'jobs';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export async function connectQueue(): Promise<Channel> {
  if (channel) return channel;
  connection = await amqplib.connect(config.RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  return channel;
}

export async function publishJob(payload: { jobId: string }): Promise<void> {
  const ch = await connectQueue();
  const message = JSON.stringify(payload);

  console.log('[RabbitMQ Publish]', JSON.stringify({
    queue: QUEUE_NAME,
    payload,
    timestamp: new Date().toISOString(),
  }, null, 2));

  const ok = ch.sendToQueue(QUEUE_NAME, Buffer.from(message), {
    persistent: true,
  });

  console.log(`[RabbitMQ Publish] result: ${ok ? 'queued' : 'buffer full (backpressure)'}`);
}

export async function closeQueue(): Promise<void> {
  await channel?.close();
  await connection?.close();
  channel = null;
  connection = null;
}
