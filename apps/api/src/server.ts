import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';

const server = Fastify({
  logger: true
});

server.register(cors);
server.register(authPlugin);

server.register(authRoutes, { prefix: '/api/auth' });

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
