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
  ch.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
}

export async function closeQueue(): Promise<void> {
  await channel?.close();
  await connection?.close();
  channel = null;
  connection = null;
}
