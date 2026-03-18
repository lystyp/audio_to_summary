import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const dateField = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.string().datetime(),
);

export const JobStatusSchema = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).openapi({
  description: '任務處理狀態',
  example: 'PENDING',
});

export const JobSchema = z
  .object({
    id: z.string().uuid().openapi({ description: '任務唯一識別碼', example: 'a1b2c3d4-...' }),
    originalName: z.string().openapi({ description: '原始上傳檔名', example: 'meeting.mp3' }),
    storagePath: z.string().openapi({ description: 'GCS 儲存路徑', example: 'gs://bucket/file.mp3' }),
    status: JobStatusSchema,
    transcript: z.string().nullable().openapi({ description: '語音轉文字結果', example: '今天會議討論...' }),
    summary: z.string().nullable().openapi({ description: 'LLM 摘要結果', example: '本次會議重點...' }),
    errorMessage: z.string().nullable().openapi({ description: '失敗原因（僅 FAILED 時有值）' }),
    createdAt: dateField.openapi({ description: '建立時間 (ISO 8601)', example: '2026-03-18T00:00:00.000Z' }),
    updatedAt: dateField.openapi({ description: '最後更新時間 (ISO 8601)', example: '2026-03-18T00:01:00.000Z' }),
  })
  .openapi('Job');

export const JobCreatedDataSchema = z
  .object({
    jobId: z.string().uuid().openapi({ description: '任務 UUID', example: 'a1b2c3d4-...' }),
    status: JobStatusSchema,
  })
  .openapi('JobCreatedData');

export const JobListItemSchema = z.object({
  id: z.string().uuid().openapi({ description: '任務 UUID', example: 'a1b2c3d4-...' }),
  originalName: z.string().openapi({ description: '原始上傳檔名', example: 'meeting.mp3' }),
  status: JobStatusSchema,
  createdAt: dateField.openapi({ description: '建立時間 (ISO 8601)', example: '2026-03-18T00:00:00.000Z' }),
  updatedAt: dateField.openapi({ description: '最後更新時間 (ISO 8601)', example: '2026-03-18T00:01:00.000Z' }),
});

export const JobListDataSchema = z
  .object({
    items: z.array(JobListItemSchema).openapi({ description: '任務列表' }),
    total: z.number().int().openapi({ description: '總筆數', example: 42 }),
    page: z.number().int().openapi({ description: '目前頁碼', example: 1 }),
    limit: z.number().int().openapi({ description: '每頁筆數', example: 20 }),
  })
  .openapi('JobListData');

export const ErrorBodySchema = z
  .object({
    code: z.string().openapi({ description: '錯誤代碼', example: 'JOB_NOT_FOUND' }),
    message: z.string().openapi({ description: '錯誤訊息', example: '找不到任務' }),
  })
  .openapi('ErrorBody');

// Response wrapper schemas
export const CreateJobResponseSchema = z.object({ success: z.literal(true), data: JobCreatedDataSchema });
export const ListJobsResponseSchema = z.object({ success: z.literal(true), data: JobListDataSchema });
export const GetJobResponseSchema = z.object({ success: z.literal(true), data: JobSchema });
export const RetryJobResponseSchema = z.object({ success: z.literal(true), data: JobCreatedDataSchema });
export const ErrorResponseSchema = z
  .object({ success: z.literal(false), error: ErrorBodySchema })
  .openapi('ErrorResponse');
