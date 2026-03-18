import { Request, Response, NextFunction } from 'express';
import { logger } from '@daniel/shared';

export const requestDetails = (req: Request, res: Response, next: NextFunction) => {

  const reqDetails: Record<string, unknown> = {
    method: req.method,
    url: req.originalUrl,
  };

  if (Object.keys(req.query).length > 0) {
    reqDetails.query = req.query;
  }

  if (req.body && Object.keys(req.body).length > 0) {
    reqDetails.body = req.body;
  }

  logger.info({ req: reqDetails }, 'incoming request');

  // 攔截 res.json 以取得 response body
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    logger.info({ status: res.statusCode, body }, 'outgoing response');
    return originalJson(body);
  };

  next();

};
