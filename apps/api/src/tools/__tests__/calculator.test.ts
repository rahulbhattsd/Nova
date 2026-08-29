import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calculatorTool } from '../calculator';
import { PrismaClient } from '@nova/database';

const prisma = new PrismaClient();

describe('Calculator Tool', () => {
  beforeEach(async () => {
    // Clean up before each test
    await prisma.toolExecution.deleteMany({
      where: { toolName: 'calculator' }
    });
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.toolExecution.deleteMany({
      where: { toolName: 'calculator' }
    });
  });

  it('should evaluate a valid expression', async () => {
    const input = { expression: '2 + 2 * 3' };
    const result = await calculatorTool.execute(input);
    expect(result).toEqual({ result: 8 });

    // Verify logging
    const logs = await prisma.toolExecution.findMany({ where: { toolName: 'calculator' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('SUCCESS');
    expect(logs[0].output).toEqual({ result: 8 });
    expect(logs[0].input).toEqual(input);
  });

  it('should handle division by zero', async () => {
    const input = { expression: '10 / 0' };
    const result = await calculatorTool.execute(input);
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Division by zero');

    // Verify logging
    const logs = await prisma.toolExecution.findMany({ where: { toolName: 'calculator' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('FAILED');
    expect(logs[0].error).toContain('Division by zero');
  });

  it('should handle invalid syntax', async () => {
    const input = { expression: '2 + * 3' };
    const result = await calculatorTool.execute(input);
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Math evaluation error');

    // Verify logging
    const logs = await prisma.toolExecution.findMany({ where: { toolName: 'calculator' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('FAILED');
    expect(logs[0].error).toContain('Math evaluation error');
  });

  it('should reject non-math javascript injection', async () => {
    const input = { expression: 'console.log("hello")' };
    const result = await calculatorTool.execute(input);
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Invalid syntax or unsupported operation');

    // Verify logging
    const logs = await prisma.toolExecution.findMany({ where: { toolName: 'calculator' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('FAILED');
  });

});
