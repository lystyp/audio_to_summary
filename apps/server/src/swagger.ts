import { fileURLToPath } from 'url';
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: '音訊轉錄與摘要 API',
      version: '1.0.0',
      description: '上傳音訊檔案，非同步執行語音轉文字與 LLM 摘要。',
    },
    components: {
      schemas: {
        Job: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            originalName: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] },
            transcript: { type: 'string', nullable: true },
            summary: { type: 'string', nullable: true },
            errorMessage: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  // swagger-jsdoc 讀取 JSDoc 註解，需要指向 .ts 原始檔
  apis: [path.join(__dirname, '../src/routes/*.ts'), path.join(__dirname, 'routes/*.js')],
});
