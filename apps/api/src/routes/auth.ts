import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { hashPassword, verifyPassword } from '../security/password';
import { prisma } from '@nova/database';

export default async function (fastify: FastifyInstance) {
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    try {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
         return reply.code(400).send({ error: 'User already exists' });
      }

      const hashedPassword = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        }
      });

      const token = fastify.jwt.sign({ userId: user.id, email: user.email });
      return { token, user: { id: user.id, email: user.email } };
    } catch (e) {
      fastify.log.error(e);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
       return reply.code(400).send({ error: 'Email and password are required' });
    }

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const isMatch = await verifyPassword(password, user.password);
      if (!isMatch) {
         return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const token = fastify.jwt.sign({ userId: user.id, email: user.email });
      return { token, user: { id: user.id, email: user.email } };
    } catch (e) {
      fastify.log.error(e);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/me', {
    preValidation: [(fastify as any).authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return { user: request.user };
  });
}
