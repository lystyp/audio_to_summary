import { config, prisma, connectQueue, QUEUE_NAME, logger } from '@daniel/shared';
import { transcribe } from './services/stt.js';
import { summarize } from './services/llm.js';

// 確保 config 已載入
void config;

async function start() {
  logger.info('Worker 啟動中...');

  const channel = await connectQueue();
  channel.prefetch(1);

  logger.info(`等待 ${QUEUE_NAME} 佇列的任務...`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    const payload = JSON.parse(msg.content.toString()) as { jobId: string };
    logger.info({ queue: QUEUE_NAME, payload }, 'RabbitMQ consume');

    const { jobId } = payload;
    logger.info({ jobId }, '處理任務');

    try {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) {
        logger.error({ jobId }, '找不到任務');
        channel.ack(msg);
        return;
      }

      await prisma.job.update({ where: { id: jobId }, data: { status: 'PROCESSING' } });

      logger.info({ jobId }, '開始語音轉文字...');
      const transcript = await transcribe(job.storagePath);

      logger.info({ jobId }, '語音轉文字結果:', { transcript: transcript.slice(0, 100) + '..., 開始摘要...' });
      const summary = await summarize(transcript);

      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', transcript, summary },
      });

      logger.info({ jobId }, '任務完成');
      channel.ack(msg);
    } catch (err) {
      logger.error({ jobId, err }, '處理失敗');
      await prisma.job
        .update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        })
        .catch((e: unknown) => logger.error({ jobId, err: e }, 'DB 更新失敗狀態時出錯'));
      channel.ack(msg);
    }
  });
}

start().catch((err) => {
  logger.error(err, 'Worker 啟動失敗');
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
