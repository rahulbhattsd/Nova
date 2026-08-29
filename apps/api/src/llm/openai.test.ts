import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from './openai';

// Mock Prisma
vi.mock('@nova/database', () => {
  const mockCreate = vi.fn();
  return {
    mockCreate,
    prisma: {
      usageRecord: {
        create: mockCreate,
      },
    },
  };
});

// Mock OpenAI
vi.mock('openai', () => {
  const mockCreateCompletion = vi.fn();
  return {
    mockCreateCompletion,
    default: class {
      chat = {
        completions: {
          create: mockCreateCompletion,
        },
      };
    },
  };
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockCreateCompletion: any;
  let mockCreate: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Dynamically import to get the mocks
    const dbMock = await import('@nova/database');
    const openaiMock = await import('openai');
    mockCreate = (dbMock as any).mockCreate;
    mockCreateCompletion = (openaiMock as any).mockCreateCompletion;

    provider = new OpenAIProvider('fake-api-key');
  });

  it('should call openai and record usage for complete()', async () => {
    mockCreateCompletion.mockResolvedValue({
      choices: [{ message: { content: 'hello world' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });

    const res = await provider.complete([{ role: 'user', content: 'hi' }]);

    expect(mockCreateCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      })
    );

    expect(res.content).toBe('hello world');
    expect(res.inputTokens).toBe(10);
    expect(res.outputTokens).toBe(20);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          model: 'gpt-4o',
          inputTokens: 10,
          outputTokens: 20,
          estimatedCost: expect.any(Number),
        },
      })
    );
  });

  it('should request json_schema and parse for completeStructured()', async () => {
    mockCreateCompletion.mockResolvedValue({
      choices: [{ message: { content: '{"answer":42}' } }],
      usage: { prompt_tokens: 15, completion_tokens: 5 },
    });

    const res = await provider.completeStructured(
      [{ role: 'user', content: 'math' }],
      { name: 'math_schema', schema: { type: 'object' } }
    );

    expect(mockCreateCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'math_schema', schema: { type: 'object' }, strict: true, description: undefined },
        },
      })
    );

    expect(res.parsed).toEqual({ answer: 42 });
    expect(mockCreate).toHaveBeenCalled();
  });

  it('should stream chunks', async () => {
    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: 'chunk1' } }] };
      yield { choices: [{ delta: { content: 'chunk2' } }], usage: { prompt_tokens: 5, completion_tokens: 10 } };
    })();

    mockCreateCompletion.mockResolvedValue(mockStream);

    const chunks = [];
    for await (const chunk of provider.stream([{ role: 'user', content: 'stream' }])) {
      chunks.push(chunk);
    }

    expect(chunks.join('')).toBe('chunk1chunk2');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inputTokens: 5,
          outputTokens: 10,
        }),
      })
    );
  });
});
