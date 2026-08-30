import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../../plugins/auth';
import taskRoutes from '../tasks';
import { PrismaClient } from '@nova/database';
import { TaskStatus } from '@nova/agent-core';
import * as orchestrator from '../../workflows/orchestrator';
import * as llmProvider from '../../llm/index';

const prisma = new PrismaClient();

// Mock orchestrator
vi.mock('../../workflows/orchestrator', () => ({
  executeTask: vi.fn().mockResolvedValue(undefined)
}));

// Mock LLM for planner
vi.mock('../../llm/index', () => {
  return {
    createLLMProvider: vi.fn().mockImplementation(() => ({
      completeStructured: vi.fn().mockResolvedValue({
        parsed: { plan: [{ description: 'Test Step 1', order: 1 }] },
        model: 'mock', inputTokens: 10, outputTokens: 10
      })
    }))
  };
});

describe('Task API Routes', () => {
  let app: any;
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    app = Fastify();
    await app.register(authPlugin);
    await app.register(taskRoutes, { prefix: '/api/tasks' });

    await prisma.taskStep.deleteMany();
    await prisma.task.deleteMany();
    await prisma.user.deleteMany();

    userA = await prisma.user.create({
      data: { email: 'userA@example.com', password: 'password' }
    });
    userB = await prisma.user.create({
      data: { email: 'userB@example.com', password: 'password' }
    });

    tokenA = app.jwt.sign({ id: userA.id, email: userA.email });
    tokenB = app.jwt.sign({ id: userB.id, email: userB.email });
  });

  afterEach(async () => {
    await prisma.taskStep.deleteMany();
    await prisma.task.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
    vi.clearAllMocks();
  });

  it('should create a task, generate steps, and start execution', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { objective: 'Do a test task' }
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.objective).toBe('Do a test task');
    expect(body.status).toBe(TaskStatus.READY);
    expect(body.steps).toHaveLength(1);
    expect(body.steps[0].description).toBe('Test Step 1');
    expect(body.steps[0].status).toBe(TaskStatus.PENDING);

    expect(orchestrator.executeTask).toHaveBeenCalledWith(body.id);
  });

  it('should list tasks only for the authenticated user', async () => {
    await prisma.task.create({ data: { userId: userA.id, objective: 'Task A', status: TaskStatus.PENDING }});
    await prisma.task.create({ data: { userId: userB.id, objective: 'Task B', status: TaskStatus.PENDING }});

    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).toHaveLength(1);
    expect(body[0].objective).toBe('Task A');
  });

  it('should return 403 when trying to GET another users task', async () => {
    const taskB = await prisma.task.create({
        data: { userId: userB.id, objective: 'Task B', status: TaskStatus.PENDING }
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/tasks/${taskB.id}`,
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return 403 when trying to cancel another users task', async () => {
    const taskB = await prisma.task.create({
        data: { userId: userB.id, objective: 'Task B', status: TaskStatus.PENDING }
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/tasks/${taskB.id}/cancel`,
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    expect(response.statusCode).toBe(403);

    // Ensure not cancelled
    const checkTask = await prisma.task.findUnique({ where: { id: taskB.id } });
    expect(checkTask?.status).toBe(TaskStatus.PENDING);
  });

  it('should cancel own task successfully', async () => {
    const taskA = await prisma.task.create({
        data: { userId: userA.id, objective: 'Task A', status: TaskStatus.PENDING }
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/tasks/${taskA.id}/cancel`,
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    expect(response.statusCode).toBe(200);

    const checkTask = await prisma.task.findUnique({ where: { id: taskA.id } });
    expect(checkTask?.status).toBe(TaskStatus.CANCELLED);
  });
});
