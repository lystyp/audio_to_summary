import { Request, Response, NextFunction } from 'express';

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

  console.log('[Audil server : Request]', JSON.stringify(reqDetails, null, 2));

  // 攔截 res.json 以取得 response body
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    console.log('[Audil server : Response]', JSON.stringify({
      status: res.statusCode,
      body,
    }, null, 2));
    return originalJson(body);
  };

  next();

};
