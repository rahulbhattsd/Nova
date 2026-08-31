import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../plugins/auth';
import memoryRoutes from './memory';
import { PrismaClient } from '@nova/database';
import * as memoryService from '../services/memory';

const prisma = new PrismaClient();

describe('Memory API Routes', () => {
  let app: any;
  let userA: any;
  let userB: any;
  let tokenA: string;

  beforeEach(async () => {
    app = Fastify();
    process.env.AUTH_SECRET = 'test-secret';
    await app.register(authPlugin);
    await app.register(memoryRoutes, { prefix: '/api/memory' });

    await prisma.$executeRaw`DELETE FROM "Memory"`;
    await prisma.$executeRaw`DELETE FROM "User" CASCADE`;

    userA = await prisma.user.create({
      data: { email: 'memory-a@example.com', password: 'password' }
    });
    userB = await prisma.user.create({
      data: { email: 'memory-b@example.com', password: 'password' }
    });

    tokenA = app.jwt.sign({ id: userA.id, email: userA.email });

    // Seed memories using the memoryService to easily write vectors
    await memoryService.storeMemory(userA.id, 'EPISODIC', 'Memory A', new Array(1536).fill(0.1));
    await memoryService.storeMemory(userB.id, 'EPISODIC', 'Memory B', new Array(1536).fill(0.1));
  });

  afterEach(async () => {
    await prisma.$executeRaw`DELETE FROM "Memory"`;
    await prisma.$executeRaw`DELETE FROM "User" CASCADE`;
    await app.close();
  });

  it('should list only the authenticated users memories', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/memory',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).toHaveLength(1);
    expect(body[0].content).toBe('Memory A');
  });

  it('should allow user to delete their own memory', async () => {
    const memories = await prisma.$queryRaw<any[]>`SELECT id FROM "Memory" WHERE "userId" = ${userA.id}`;
    const memoryAId = memories[0].id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/memory/${memoryAId}`,
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    expect(response.statusCode).toBe(200);

    const check = await prisma.$queryRaw<any[]>`SELECT id FROM "Memory" WHERE "userId" = ${userA.id}`;
    expect(check).toHaveLength(0);
  });

  it('should not allow user to delete another users memory', async () => {
    const memories = await prisma.$queryRaw<any[]>`SELECT id FROM "Memory" WHERE "userId" = ${userB.id}`;
    const memoryBId = memories[0].id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/memory/${memoryBId}`,
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    expect(response.statusCode).toBe(403);

    // ensure memory still exists
    const check = await prisma.$queryRaw<any[]>`SELECT id FROM "Memory" WHERE "userId" = ${userB.id}`;
    expect(check).toHaveLength(1);
  });
});
