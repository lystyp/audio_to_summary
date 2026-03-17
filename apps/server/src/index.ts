import { fileURLToPath } from 'url';
import express from 'express';
import path from 'path';
import swaggerUi from 'swagger-ui-express';

import { config, prisma } from '@daniel/shared';
import { errorHandler } from './middleware/errors.js';
import { jobsRouter } from './routes/jobs.js';
import { swaggerSpec } from './swagger.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const app = express();

app.use(express.json());

// 前端靜態檔（packages/api/public/）
app.use(express.static(path.join(__dirname, '../../public')));

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API 路由
app.use('/api/jobs', jobsRouter);

// 全域錯誤處理
app.use(errorHandler);

async function start() {
  await prisma.$connect();
  app.listen(config.PORT, () => {
    console.log(`API 伺服器啟動於 http://localhost:${config.PORT}`);
    console.log(`Swagger UI: http://localhost:${config.PORT}/docs`);
  });
}

start().catch((err) => {
  console.error('伺服器啟動失敗：', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
