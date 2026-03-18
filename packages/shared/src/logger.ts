import pino from 'pino';

// 所有 log 輸出至 stdout，GCP VM 的 Cloud Logging agent 會自動捕捉
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});
