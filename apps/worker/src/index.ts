import { config, prisma, connectQueue, QUEUE_NAME } from '@daniel/shared';
import { transcribe } from './services/stt.js';
import { summarize } from './services/llm.js';

// 確保 config 已載入
void config;

async function start() {
  console.log('Worker 啟動中...');

  const channel = await connectQueue();
  channel.prefetch(1);

  console.log(`等待 ${QUEUE_NAME} 佇列的任務...`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    const { jobId } = JSON.parse(msg.content.toString()) as { jobId: string };
    console.log(`處理任務 ${jobId}`);

    try {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) {
        console.error(`找不到任務 ${jobId}`);
        channel.ack(msg);
        return;
      }

      await prisma.job.update({ where: { id: jobId }, data: { status: 'PROCESSING' } });

      console.log(`[${jobId}] 開始語音轉文字...`);
      const transcript = await transcribe(job.storagePath);

      console.log(`[${jobId}] 開始生成摘要...`);
      const summary = await summarize(transcript);

      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', transcript, summary },
      });

      console.log(`[${jobId}] 完成`);
      channel.ack(msg);
    } catch (err) {
      console.error(`[${jobId}] 處理失敗：`, err);
      await prisma.job
        .update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        })
        .catch(console.error);
      channel.ack(msg);
    }
  });
}

start().catch((err) => {
  console.error('Worker 啟動失敗：', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
