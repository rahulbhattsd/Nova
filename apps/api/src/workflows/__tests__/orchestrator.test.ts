import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@nova/database';
import { TaskStatus } from '@nova/agent-core';
import { executeTask } from '../orchestrator';
import { registry } from '../../tools/registry';
import * as llmProvider from '../../llm/index';
import { calculatorTool } from '../../tools/calculator';
import { fileReaderTool } from '../../tools/fileReader';
import { webSearchTool } from '../../tools/webSearch';

const prisma = new PrismaClient();

// Mock the LLM provider creation
vi.mock('../../llm/index', () => {
  return {
    createLLMProvider: vi.fn()
  };
});

// For failing test, we'll spy on a real tool and force it to fail
const failingToolName = calculatorTool.name;

describe('Orchestrator Execution', () => {
  let user: any;

  beforeEach(async () => {
    registry.clear();
    registry.register(calculatorTool);
    registry.register(fileReaderTool);
    registry.register(webSearchTool);

    await prisma.toolExecution.deleteMany();
    await prisma.taskStep.deleteMany();
    await prisma.task.deleteMany();
    await prisma.user.deleteMany();

    user = await prisma.user.create({
      data: {
        email: 'orchestrator-test@example.com',
        password: 'password123'
      }
    });
  });

  afterEach(async () => {
    await prisma.toolExecution.deleteMany();
    await prisma.taskStep.deleteMany();
    await prisma.task.deleteMany();
    await prisma.user.deleteMany();
    vi.clearAllMocks();
  });

  it('should successfully execute a task with multiple steps', async () => {
    // Mock LLM to return tool selection corresponding to real tools
    const mockCompleteStructured = vi.fn()
      .mockResolvedValueOnce({
        parsed: { toolName: 'calculator', input: { expression: '2+2' } },
        model: 'mock', inputTokens: 10, outputTokens: 10
      })
      .mockResolvedValueOnce({
        parsed: { toolName: 'calculator', input: { expression: '3*3' } },
        model: 'mock', inputTokens: 10, outputTokens: 10
      });

    vi.mocked(llmProvider.createLLMProvider).mockReturnValue({
      complete: vi.fn(),
      completeStructured: mockCompleteStructured as any,
      stream: vi.fn() as any
    });

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        objective: 'Test Objective',
        status: TaskStatus.READY,
        steps: {
          create: [
            { description: 'Step 1', order: 1, status: TaskStatus.PENDING },
            { description: 'Step 2', order: 2, status: TaskStatus.PENDING }
          ]
        }
      }
    });

    await executeTask(task.id);

    const updatedTask = await prisma.task.findUnique({
      where: { id: task.id },
      include: { steps: { orderBy: { order: 'asc' } } }
    });

    expect(updatedTask?.status).toBe(TaskStatus.COMPLETED);
    expect(updatedTask?.steps).toHaveLength(2);
    expect(updatedTask?.steps[0].status).toBe(TaskStatus.COMPLETED);
    expect(updatedTask?.steps[0].completedAt).toBeDefined();
    expect(updatedTask?.steps[1].status).toBe(TaskStatus.COMPLETED);
    expect(updatedTask?.steps[1].completedAt).toBeDefined();
    expect(mockCompleteStructured).toHaveBeenCalledTimes(2);
  });

  it('should fail task and step when maxRetries is reached', async () => {
    // Make the real calculator tool fail
    const originalExecute = calculatorTool.execute;
    calculatorTool.execute = vi.fn().mockResolvedValue({ error: 'Forced failure for test' });

    const mockCompleteStructured = vi.fn().mockResolvedValue({
        parsed: { toolName: 'calculator', input: { expression: 'error' } },
        model: 'mock', inputTokens: 10, outputTokens: 10
    });

    vi.mocked(llmProvider.createLLMProvider).mockReturnValue({
      complete: vi.fn(),
      completeStructured: mockCompleteStructured as any,
      stream: vi.fn() as any
    });

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        objective: 'Test Failure Objective',
        status: TaskStatus.READY,
        steps: {
          create: [
            { description: 'Failing Step', order: 1, status: TaskStatus.PENDING }
          ]
        }
      }
    });

    await executeTask(task.id);

    const updatedTask = await prisma.task.findUnique({
      where: { id: task.id },
      include: { steps: true }
    });

    expect(updatedTask?.status).toBe(TaskStatus.FAILED);
    expect(updatedTask?.steps).toHaveLength(1);
    expect(updatedTask?.steps[0].status).toBe(TaskStatus.FAILED);
    expect(updatedTask?.steps[0].error).toContain('Forced failure for test');

    // The tool should be attempted (maxRetries + 1) times.
    // In our implementation, maxRetries is 3, so it tries once + 3 retries = 4 attempts.
    expect(mockCompleteStructured).toHaveBeenCalledTimes(4);

    // Restore
    calculatorTool.execute = originalExecute;
  });
});
