import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './docs/registry.js';

const generator = new OpenApiGeneratorV3(registry.definitions);

export const swaggerSpec: object = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    title: '音訊轉錄與摘要 API',
    version: '1.0.0',
    description: '上傳音訊檔案，非同步執行語音轉文字與 LLM 摘要。',
  },
  servers: [{ url: '/' }],
});
