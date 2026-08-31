import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../plugins/auth';
import profileRoutes from './profile';
import { PrismaClient } from '@nova/database';
import * as llmProvider from '../llm/index';

const prisma = new PrismaClient();

// Mock LLM provider
vi.mock('../llm/index', () => {
  return {
    createLLMProvider: vi.fn().mockImplementation(() => ({
      embed: vi.fn().mockResolvedValue(new Array(1536).fill(0.1))
    }))
  };
});

describe('Profile API Routes', () => {
  let app: any;
  let user: any;
  let token: string;

  beforeEach(async () => {
    app = Fastify();
    process.env.AUTH_SECRET = 'test-secret';
    await app.register(authPlugin);
    await app.register(profileRoutes, { prefix: '/api/profile' });

    await prisma.$executeRaw`DELETE FROM "Memory"`;
    await prisma.userProfile.deleteMany();
    await prisma.$executeRaw`DELETE FROM "User" CASCADE`;

    user = await prisma.user.create({
      data: { email: 'profile-user@example.com', password: 'password' }
    });

    token = app.jwt.sign({ id: user.id, email: user.email });
  });

  afterEach(async () => {
    await prisma.$executeRaw`DELETE FROM "Memory"`;
    await prisma.userProfile.deleteMany();
    await prisma.$executeRaw`DELETE FROM "User" CASCADE`;
    await app.close();
    vi.clearAllMocks();
  });

  it('should create and update a user profile and store skills in SEMANTIC memory', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: { Authorization: `Bearer ${token}` },
      payload: { skills: ['Node.js', 'React'] }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.skills).toEqual(['Node.js', 'React']);

    // Check if semantic memory was saved
    const memories = await prisma.$queryRaw<any[]>`SELECT id, "userId", type, content, "taskId", "createdAt" FROM "Memory" WHERE "userId" = ${user.id} AND type = 'SEMANTIC'`;

    expect(memories).toHaveLength(1);
    expect(memories[0].content).toContain('User has the following skills: Node.js, React');
  });
});
