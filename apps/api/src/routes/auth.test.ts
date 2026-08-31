import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import authRoutes from './auth';
import authPlugin from '../plugins/auth';
import rateLimit from '@fastify/rate-limit';
import { prisma } from '@nova/database';
import { hashPassword } from '../security/password';

const buildServer = async () => {
  const server = Fastify();
  process.env.AUTH_SECRET = 'test-secret';

  await server.register(rateLimit, { global: false });
  await server.register(authPlugin);
  await server.register(authRoutes, { prefix: '/api/auth' });

  return server;
};

describe('Auth Routes', () => {
  let server: any;

  beforeAll(async () => {
    server = await buildServer();
    await server.ready();

    // Clean up any existing test user
    await prisma.$executeRaw`DELETE FROM "Memory"`;
    await prisma.$executeRaw`DELETE FROM "User" CASCADE`;
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM "Memory"`;
    await prisma.$executeRaw`DELETE FROM "User" CASCADE`;
    await server.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data).toHaveProperty('token');
      expect(data.user).toHaveProperty('email', 'test@example.com');
    });

    it('should fail if user already exists', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com', // same email as above
          password: 'password123'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data).toHaveProperty('error', 'User already exists');
    });

    it('should fail with invalid email format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'password123'
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with short password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test2@example.com',
          password: 'short'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      const hashedPassword = await hashPassword('correctpassword');
      await prisma.user.create({
        data: {
          email: 'test-login@example.com',
          password: hashedPassword
        }
      });
    });

    it('should login successfully with correct credentials', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test-login@example.com',
          password: 'correctpassword'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data).toHaveProperty('token');
    });

    it('should fail with wrong password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test-login@example.com',
          password: 'wrongpassword'
        }
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.payload);
      expect(data).toHaveProperty('error', 'Invalid credentials');
    });
  });
});
