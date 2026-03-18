import path from 'path';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma, publishJob, storageProvider } from '@daniel/shared';
import { upload } from '../middleware/upload.js';
import { register, unregister } from '../sse.js';
import {
  CreateJobResponseSchema,
  GetJobResponseSchema,
  ListJobsResponseSchema,
  RetryJobResponseSchema,
} from '../schemas/job.schema.js';

export const jobsRouter: Router = Router();

jobsRouter.post(
  '/',
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

      res.status(202).json(
        CreateJobResponseSchema.parse({ success: true, data: { jobId: job.id, status: job.status } }),
      );
    } catch (err) {
      next(err);
    }
  },
);

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

    res.json(ListJobsResponseSchema.parse({ success: true, data: { items, total, page, limit } }));
  } catch (err) {
    next(err);
  }
});

jobsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) {
      res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: '找不到任務' } });
      return;
    }
    res.json(GetJobResponseSchema.parse({ success: true, data: job }));
  } catch (err) {
    next(err);
  }
});

jobsRouter.get('/:id/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string;

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: '找不到任務' } });
      return;
    }

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      res.json(GetJobResponseSchema.parse({ success: true, data: job }));
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

const AUDIO_CONTENT_TYPE: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

jobsRouter.get('/:id/audio', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) {
      res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: '找不到任務' } });
      return;
    }
    const ext = path.extname(job.storagePath).toLowerCase();
    res.setHeader('Content-Type', AUDIO_CONTENT_TYPE[ext] ?? 'application/octet-stream');
    storageProvider.download(job.storagePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

jobsRouter.post('/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) {
      res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: '找不到任務' } });
      return;
    }
    if (job.status !== 'FAILED') {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: '只有失敗的任務可以重試' } });
      return;
    }
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'PENDING', errorMessage: null },
    });
    await publishJob({ jobId: job.id });
    res.json(RetryJobResponseSchema.parse({ success: true, data: { jobId: job.id, status: 'PENDING' } }));
  } catch (err) {
    next(err);
  }
});
