import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['local', 'prd']).default('local'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  RABBITMQ_URL: z.string(),
  GEMINI_API_KEY: z.string(),
  STT_LANGUAGE_CODE: z.string().default('zh-TW'),
  GCS_BUCKET: z.string(),
  MAX_FILE_SIZE_MB: z.coerce.number().default(100),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ 環境變數錯誤：');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
