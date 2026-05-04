import type { FastifyInstance } from 'fastify';
import { getAllQuotes, getQuote } from '../lib/quoteCache.js';

export async function quotesRoutes(app: FastifyInstance) {
  app.get('/', async () => ({ quotes: getAllQuotes() }));

  app.get('/:symbol', async (req, reply) => {
    const { symbol } = req.params as { symbol: string };
    const q = getQuote(symbol);
    if (!q) return reply.code(404).send({ error: 'not_found' });
    return q;
  });
}
