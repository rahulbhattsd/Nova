import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@nova/database';

export default async function (fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.user as any).id;

    try {
      const memories = await prisma.$queryRaw<any[]>`
        SELECT id, "userId", type, content, "taskId", "createdAt"
        FROM "Memory"
        WHERE "userId" = ${userId}
        ORDER BY "createdAt" DESC
      `;
      return reply.code(200).send(memories);
    } catch (e) {
      fastify.log.error(e);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as any).id;

    try {
      const memory = await prisma.memory.findUnique({ where: { id } });

      if (!memory) {
        return reply.code(404).send({ error: 'Memory not found' });
      }

      if (memory.userId !== userId) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      await prisma.$executeRaw`DELETE FROM "Memory" WHERE id = ${id}`;

      return reply.code(200).send({ message: 'Memory deleted successfully' });
    } catch (e) {
      fastify.log.error(e);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
