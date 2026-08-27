import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';

export default fp(async (fastify) => {
  fastify.register(fastifyJwt, {
    secret: process.env.AUTH_SECRET || 'super-secret-default-key' // Should be overriden in production
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });
});
