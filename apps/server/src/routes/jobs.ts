import { Router, Request, Response, NextFunction } from 'express';
import { prisma, publishJob } from '@daniel/shared';
import { upload } from '../middleware/upload.js';
import { register, unregister } from '../sse.js';

export const jobsRouter:Router = Router();

/**
 * @swagger
 * /api/jobs:
 *   post:
 *     tags: [Jobs]
 *     summary: 上傳音訊檔案並建立任務
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [audio]
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *     responses:
 *       202:
 *         description: 任務已建立
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId: { type: string, format: uuid }
 *                     status: { type: string }
 *       400:
 *         description: 未上傳檔案或格式不支援
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
jobsRouter.post('/',
  upload.single('audio'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: { code: 'NO_FILE', message: '請上傳音訊檔案' } });
        return;
      }

      const job = await prisma.job.create({
        data: {
          originalName: req.file.originalname,
          storagePath: req.file.path,
        },
      });

      await publishJob({ jobId: job.id });

      res.status(202).json({ success: true, data: { jobId: job.id, status: job.status } });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     tags: [Jobs]
 *     summary: 列出所有任務
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PROCESSING, COMPLETED, FAILED]
 *     responses:
 *       200:
 *         description: 任務列表
 */
jobsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1')));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'))));
    const status = req.query.status as string | undefined;

    const where = status ? { status: status as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' } : {};

    const [items, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, originalName: true, status: true, createdAt: true, updatedAt: true },
      }),
      prisma.job.count({ where }),
    ]);

    res.json({ success: true, data: { items, total, page, limit } });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     tags: [Jobs]
 *     summary: 查詢單一任務詳情
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 任務詳情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/Job'
 *       404:
 *         description: 找不到任務
 */
jobsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) {
      res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: '找不到任務' } });
      return;
    }
    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/jobs/{id}/events:
 *   get:
 *     tags: [Jobs]
 *     summary: SSE 即時任務狀態串流
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Server-Sent Events 串流
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
jobsRouter.get('/:id/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: '找不到任務' } });
      return;
    }

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      res.json({ success: true, data: job });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify(job)}\n\n`);
    register(id, res);

    const timer = setInterval(async () => {
      try {
        const latest = await prisma.job.findUnique({ where: { id } });
        if (!latest) return;
        res.write(`data: ${JSON.stringify(latest)}\n\n`);
        if (latest.status === 'COMPLETED' || latest.status === 'FAILED') {
          clearInterval(timer);
          unregister(id, res);
          res.end();
        }
      } catch {
        clearInterval(timer);
        res.end();
      }
    }, 1000);

    req.on('close', () => {
      clearInterval(timer);
      unregister(id, res);
    });
  } catch (err) {
    next(err);
  }
});
