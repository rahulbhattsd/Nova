import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webSearchTool, _setSearchProvider, MockSearchProvider } from '../webSearch';
import { PrismaClient } from '@nova/database';

const prisma = new PrismaClient();

describe('Web Search Tool', () => {
  const originalEnv = process.env.SEARCH_API_KEY;

  beforeEach(async () => {
    // Clean up DB before each test
    await prisma.toolExecution.deleteMany({
      where: { toolName: 'webSearch' }
    });
  });

  afterEach(async () => {
    // Clean up DB after each test
    await prisma.toolExecution.deleteMany({
      where: { toolName: 'webSearch' }
    });
    process.env.SEARCH_API_KEY = originalEnv;
  });

  it('should return mock results when key is present', async () => {
    process.env.SEARCH_API_KEY = 'test-key';
    const mockProvider = new MockSearchProvider();
    _setSearchProvider(mockProvider);

    const input = { query: 'test query', maxResults: 2 };
    const result = await webSearchTool.execute(input);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].title).toBe('Mock Result 1 for test query');

    // Verify logging
    const logs = await prisma.toolExecution.findMany({ where: { toolName: 'webSearch' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('SUCCESS');
    expect(logs[0].input).toEqual(input);
    expect(logs[0].output).toBeDefined();
  });

  it('should return "not configured" error when API key is missing', async () => {
    delete process.env.SEARCH_API_KEY;
    const mockProvider = new MockSearchProvider();
    _setSearchProvider(mockProvider);

    const input = { query: 'test query' };
    const result = await webSearchTool.execute(input);
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Web search is not configured (SEARCH_API_KEY is missing)');

    // Verify logging
    const logs = await prisma.toolExecution.findMany({ where: { toolName: 'webSearch' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('FAILED');
    expect(logs[0].error).toContain('not configured');
  });

  it('should propagate provider errors', async () => {
    process.env.SEARCH_API_KEY = 'test-key';
    const mockProvider = new MockSearchProvider();
    mockProvider.throwError = true;
    _setSearchProvider(mockProvider);

    const input = { query: 'test query' };
    const result = await webSearchTool.execute(input);
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Tavily search provider failed');

    // Verify logging
    const logs = await prisma.toolExecution.findMany({ where: { toolName: 'webSearch' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('FAILED');
    expect(logs[0].error).toContain('provider failed');
  });

});
