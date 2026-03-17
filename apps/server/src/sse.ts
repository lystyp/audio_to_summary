import { Response } from 'express';

const clients = new Map<string, Set<Response>>();

export function register(jobId: string, res: Response): void {
  if (!clients.has(jobId)) clients.set(jobId, new Set());
  clients.get(jobId)!.add(res);
}

export function unregister(jobId: string, res: Response): void {
  clients.get(jobId)?.delete(res);
  if (clients.get(jobId)?.size === 0) clients.delete(jobId);
}

export function broadcast(jobId: string, data: object): void {
  const connections = clients.get(jobId);
  if (!connections) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of connections) {
    res.write(payload);
  }
}
