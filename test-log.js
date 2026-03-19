import pino from './node_modules/.pnpm/pino@9.14.0/node_modules/pino/pino.js';

const logger = pino({
  level: 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

setInterval(() => {
  process.stdout.write(`[stdout] Daniel test ${new Date().toISOString()}\n`);
  logger.info(`[pino] Daniel test ${new Date().toISOString()}\n`);
}, 1000);
