import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@nova/database';
import { TaskStatus } from '@nova/agent-core';
import { PlannerAgent } from '../agents/planner';
import { createLLMProvider } from '../llm';
import { executeTask } from '../workflows/orchestrator';

export default async function (fastify: FastifyInstance) {

  // Protect all task routes
  fastify.addHook('onRequest', fastify.authenticate);

  const llmProvider = createLLMProvider();
  const plannerAgent = new PlannerAgent(llmProvider);

  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { objective } = request.body as { objective: string };

    if (!objective) {
      return reply.code(400).send({ error: 'Objective is required' });
    }

    // 1. Create Task in PENDING state
    const task = await prisma.task.create({
      data: {
        userId: (request.user as any).id,
        objective,
        status: TaskStatus.PENDING
      }
    });

    try {
      // Transition to PLANNING state
      await prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.PLANNING }
      });

      // 2. Call PlannerAgent to get plan
      const planOutput = await plannerAgent.plan(objective, (request.user as any).id);

      // 3. Create TaskSteps
      const stepData = planOutput.plan.map(step => ({
        taskId: task.id,
        description: step.description,
        order: step.order,
        status: TaskStatus.PENDING
      }));

      await prisma.taskStep.createMany({
        data: stepData
      });

      // 4. Transition to READY
      const readyTask = await prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.READY },
        include: { steps: true }
      });

      // 5. Fire orchestrator asynchronously (non-blocking)
      // Execution mode justification: No queue/Redis in this phase, async execution allows immediate return of task info for polling.
      executeTask(readyTask.id).catch(err => {
         console.error('Async orchestrator failed:', err);
      });

      return reply.code(201).send(readyTask);
    } catch (error) {
      // Handle planning failure
      await prisma.task.update({
         where: { id: task.id },
         data: { status: TaskStatus.FAILED }
      });
      return reply.code(500).send({ error: 'Failed to create plan' });
    }
  });

  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tasks = await prisma.task.findMany({
      where: { userId: (request.user as any).id },
      orderBy: { createdAt: 'desc' }
    });
    return reply.send(tasks);
  });

  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const task = await prisma.task.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: 'asc' } } }
    });

    if (!task) {
      return reply.code(404).send({ error: 'Task not found' });
    }

    // Ownership check (NOVA_SPEC.md §36)
    if (task.userId !== (request.user as any).id) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    return reply.send(task);
  });

  fastify.post('/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const task = await prisma.task.findUnique({
      where: { id }
    });

    if (!task) {
      return reply.code(404).send({ error: 'Task not found' });
    }

    if (task.userId !== (request.user as any).id) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { status: TaskStatus.CANCELLED }
    });

    return reply.send(updatedTask);
  });
}
