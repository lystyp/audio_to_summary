import { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: err.message } });
    return;
  }

  if (err.message.includes('僅支援')) {
    res.status(400).json({ success: false, error: { code: 'INVALID_FILE_TYPE', message: err.message } });
    return;
  }

  console.error(err);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '伺服器發生錯誤' } });
}
