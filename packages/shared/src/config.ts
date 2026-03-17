import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['local', 'prd']).default('local'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  RABBITMQ_URL: z.string(),
  OPENAI_API_KEY: z.string(),
  WHISPER_MODEL: z.string().default('whisper-1'),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o-mini'),
  UPLOAD_DIR: z.string().default('/app/uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(100),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ 環境變數錯誤：');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
