import pino from 'pino';

const logger = pino({
  level: 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

setInterval(() => {
  process.stdout.write(`[stdout] Daniel test ${new Date().toISOString()}\n`);
  logger.info(`[pino] Daniel test ${new Date().toISOString()}`);
}, 1000);
