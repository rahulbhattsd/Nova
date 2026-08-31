import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@nova/database';
import { storeMemory } from '../services/memory';
import { createLLMProvider } from '../llm';

export default async function (fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  const llmProvider = createLLMProvider();

  fastify.patch('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { skills } = request.body as { skills?: string[] };
    const userId = (request.user as any).id;

    if (!Array.isArray(skills)) {
      return reply.code(400).send({ error: 'Skills must be an array of strings' });
    }

    try {
      // Upsert profile
      const profile = await prisma.userProfile.upsert({
        where: { userId },
        update: { skills },
        create: { userId, skills }
      });

      // Clear existing semantic memories related to skills
      await prisma.$executeRaw`DELETE FROM "Memory" WHERE "userId" = ${userId} AND type = 'SEMANTIC'`;

      // Embed and store skills
      if (skills.length > 0) {
        const skillsContent = `User has the following skills: ${skills.join(', ')}`;
        const embedding = await llmProvider.embed(skillsContent);
        await storeMemory(userId, 'SEMANTIC', skillsContent, embedding);
      }

      return reply.code(200).send(profile);
    } catch (e) {
      fastify.log.error(e);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.user as any).id;
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
      return reply.code(404).send({ error: 'Profile not found' });
    }
    return reply.code(200).send(profile);
  });
}
