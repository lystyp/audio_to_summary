import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  CreateJobResponseSchema,
  ErrorResponseSchema,
  GetJobResponseSchema,
  JobCreatedDataSchema,
  JobListDataSchema,
  JobSchema,
  ListJobsResponseSchema,
  RetryJobResponseSchema,
} from '../schemas/job.schema.js';

export const registry = new OpenAPIRegistry();

registry.register('Job', JobSchema);
registry.register('JobCreatedData', JobCreatedDataSchema);
registry.register('JobListData', JobListDataSchema);
registry.register('ErrorResponse', ErrorResponseSchema);

// POST /api/jobs
registry.registerPath({
  method: 'post',
  path: '/api/jobs',
  tags: ['Jobs'],
  summary: '上傳音訊檔案並建立任務',
  description: '接受 multipart/form-data 格式的音訊檔案，建立非同步處理任務並排入佇列。',
  request: {
    body: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: z.object({
            audio: z.string().openapi({ format: 'binary', description: '音訊檔案（mp3/wav/ogg/m4a）' }),
          }),
        },
      },
    },
  },
  responses: {
    202: {
      description: '任務已建立',
      content: { 'application/json': { schema: CreateJobResponseSchema } },
    },
    400: {
      description: '未上傳檔案或格式不支援',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: '伺服器錯誤',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// GET /api/jobs
registry.registerPath({
  method: 'get',
  path: '/api/jobs',
  tags: ['Jobs'],
  summary: '列出所有任務',
  description: '支援分頁與狀態篩選，依建立時間降序排列。',
  request: {
    query: z.object({
      page: z.string().optional().openapi({ description: '頁碼，預設 1', example: '1' }),
      limit: z.string().optional().openapi({ description: '每頁筆數，預設 20，最大 100', example: '20' }),
      status: z
        .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
        .optional()
        .openapi({ description: '按狀態篩選' }),
    }),
  },
  responses: {
    200: {
      description: '任務列表',
      content: { 'application/json': { schema: ListJobsResponseSchema } },
    },
    500: {
      description: '伺服器錯誤',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// GET /api/jobs/{id}
registry.registerPath({
  method: 'get',
  path: '/api/jobs/{id}',
  tags: ['Jobs'],
  summary: '查詢單一任務詳情',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ description: '任務 UUID', example: 'a1b2c3d4-...' }),
    }),
  },
  responses: {
    200: {
      description: '任務詳情',
      content: { 'application/json': { schema: GetJobResponseSchema } },
    },
    404: {
      description: '找不到任務',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: '伺服器錯誤',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// GET /api/jobs/{id}/events
registry.registerPath({
  method: 'get',
  path: '/api/jobs/{id}/events',
  tags: ['Jobs'],
  summary: 'SSE 即時任務狀態串流',
  description:
    '任務已完成或失敗時直接回傳 JSON；否則開啟 Server-Sent Events 串流，每秒推送最新狀態直到任務結束。',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ description: '任務 UUID', example: 'a1b2c3d4-...' }),
    }),
  },
  responses: {
    200: {
      description: 'SSE 串流或已完成任務的 JSON',
      content: {
        'text/event-stream': {
          schema: z.string().openapi({ description: 'Server-Sent Events 資料流' }),
        },
        'application/json': {
          schema: GetJobResponseSchema,
        },
      },
    },
    404: {
      description: '找不到任務',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// GET /api/jobs/{id}/audio
registry.registerPath({
  method: 'get',
  path: '/api/jobs/{id}/audio',
  tags: ['Jobs'],
  summary: '串流播放音訊檔案',
  description: '從 GCS 串流原始音訊，Content-Type 依副檔名決定。',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ description: '任務 UUID', example: 'a1b2c3d4-...' }),
    }),
  },
  responses: {
    200: {
      description: '音訊串流',
      content: {
        'audio/mpeg': { schema: z.string().openapi({ format: 'binary' }) },
        'audio/wav': { schema: z.string().openapi({ format: 'binary' }) },
        'audio/ogg': { schema: z.string().openapi({ format: 'binary' }) },
        'audio/mp4': { schema: z.string().openapi({ format: 'binary' }) },
      },
    },
    404: {
      description: '找不到任務',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// POST /api/jobs/{id}/retry
registry.registerPath({
  method: 'post',
  path: '/api/jobs/{id}/retry',
  tags: ['Jobs'],
  summary: '重新處理失敗的任務',
  description: '僅允許狀態為 FAILED 的任務重試，重置為 PENDING 並重新排入佇列。',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ description: '任務 UUID', example: 'a1b2c3d4-...' }),
    }),
  },
  responses: {
    200: {
      description: '已重新排入佇列',
      content: { 'application/json': { schema: RetryJobResponseSchema } },
    },
    400: {
      description: '任務狀態不是 FAILED',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: '找不到任務',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: '伺服器錯誤',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});
