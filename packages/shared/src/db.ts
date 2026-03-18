import { PrismaClient } from './generated/prisma/client/default.js';

const createPrismaClient = () =>
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

type PrismaClientWithLogs = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientWithLogs };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

prisma.$on('query', (e) => {
  const params = JSON.parse(e.params) as unknown[];
  const query = e.query.replace(/RETURNING[\s\S]+$/, 'RETURNING ...');
  console.log(
    `[DB Query] ${e.duration}ms | ${e.timestamp.toISOString()}\n` +
    `  SQL    : ${query}\n` +
    `  Params : ${JSON.stringify(params)}`,
  );
});

prisma.$on('error', (e) => {
  console.error('[DB Error]', e.message);
});

prisma.$on('warn', (e) => {
  console.warn('[DB Warn]', e.message);
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
