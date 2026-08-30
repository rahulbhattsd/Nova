import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';

const server = Fastify({
  logger: true
});

server.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
});
server.register(rateLimit, {
  global: false // We only want rate limiting on specific routes
});
server.register(authPlugin);

server.register(authRoutes, { prefix: '/api/auth' });
server.register(taskRoutes, { prefix: '/api/tasks' });

server.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
