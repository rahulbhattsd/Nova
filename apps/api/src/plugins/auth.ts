import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';

export default fp(async (fastify) => {
  if (!process.env.AUTH_SECRET) {
    throw new Error('AUTH_SECRET environment variable is not set. It must be configured with a secure random string.');
  }

  fastify.register(fastifyJwt, {
    secret: process.env.AUTH_SECRET
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });
});
