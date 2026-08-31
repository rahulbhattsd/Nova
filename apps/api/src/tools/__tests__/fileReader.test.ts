import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileReaderTool } from '../fileReader';
import { PrismaClient } from '@nova/database';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();
const WORKSPACE_DIR = path.resolve(__dirname, '../../../../../workspace-files');
const TEST_FILE = 'test.txt';
const TEST_FILE_PATH = path.join(WORKSPACE_DIR, TEST_FILE);

describe('File Reader Tool', () => {
  beforeEach(async () => {
    // Clean up DB before each test
    await prisma.toolExecution.deleteMany({
      where: { toolName: 'fileReader' }
    });
    // Create workspace dir if it doesn't exist
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
    // Write test file
    await fs.writeFile(TEST_FILE_PATH, 'Hello World!');
  });

  afterEach(async () => {
    // Clean up DB after each test
    await prisma.toolExecution.deleteMany({
      where: { toolName: 'fileReader' }
    });
    try {
      await fs.unlink(TEST_FILE_PATH);
    } catch (e) {
      // Ignore
    }
  });

  it('should read a valid file inside the workspace directory', async () => {
    const input = { filepath: TEST_FILE };
    const context = { taskId: 'test-task-123', userId: 'test-user', budget: 10, retries: 0, maxRetries: 3 };
    const result = await fileReaderTool.execute(input, context);
    expect(result).toEqual({ content: 'Hello World!' });

    // Verify logging
    const logs = await prisma.toolExecution.findMany({ where: { toolName: 'fileReader' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('SUCCESS');
    expect(logs[0].output).toEqual({ content: 'Hello World!' });
    expect(logs[0].input).toEqual(input);
    expect(logs[0].taskId).toEqual('test-task-123');
  });

  it('should reject a path traversal attempt', async () => {
    const input = { filepath: '../package.json' };
    const result = await fileReaderTool.execute(input);
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Access denied: Cannot read files outside the workspace directory.');

    // Verify logging
    const logs = await prisma.toolExecution.findMany({ where: { toolName: 'fileReader' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('FAILED');
    expect(logs[0].error).toContain('Access denied');
  });

  it('should handle non-existent files gracefully', async () => {
    const input = { filepath: 'does_not_exist.txt' };
    const result = await fileReaderTool.execute(input);
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('File not found: does_not_exist.txt');

    // Verify logging
    const logs = await prisma.toolExecution.findMany({ where: { toolName: 'fileReader' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('FAILED');
    expect(logs[0].error).toContain('File not found');
  });

});
