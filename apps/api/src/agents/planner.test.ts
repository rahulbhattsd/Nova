import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlannerAgent } from './planner';
import { MockProvider } from '../llm/mock';
import { LLMMessage, StructuredOutputOptions, LLMCompletionOptions, LLMStructuredResponse } from '../llm/interfaces';
import * as memoryService from '../services/memory';

vi.mock('../services/memory', () => ({
  searchSimilarMemories: vi.fn()
}));

// We override the completeStructured behavior of MockProvider to return a valid PlannerOutput
class TestMockProvider extends MockProvider {
  async completeStructured<T>(
    messages: LLMMessage[],
    structuredOptions: StructuredOutputOptions<T>,
    options?: LLMCompletionOptions
  ): Promise<LLMStructuredResponse<T>> {
    // Generate a mock response for PlannerOutput
    const parsed = {
      plan: [
        { description: 'Step 1: Do something', order: 1 },
        { description: 'Step 2: Do something else', order: 2 }
      ]
    } as unknown as T;

    return {
      parsed,
      model: options?.model || 'mock-model',
      inputTokens: 10,
      outputTokens: 20
    };
  }
}

describe('PlannerAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a structured plan for a given objective without userId', async () => {
    const provider = new TestMockProvider();
    const spy = vi.spyOn(provider, 'completeStructured');
    const planner = new PlannerAgent(provider);

    const objective = 'Analyze the latest job postings';
    const output = await planner.plan(objective);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: expect.stringContaining(objective) })
      ]),
      expect.objectContaining({
        name: 'plan',
        schema: expect.any(Object)
      })
    );

    expect(output).toHaveProperty('plan');
    expect(output.plan).toBeInstanceOf(Array);
    expect(output.plan.length).toBe(2);
  });

  it('should query memory and include context if userId is provided', async () => {
    const provider = new TestMockProvider();
    const spy = vi.spyOn(provider, 'completeStructured');

    vi.mocked(memoryService.searchSimilarMemories).mockImplementation(async (userId, embedding, topK, type) => {
       if (type === 'SEMANTIC') return [{ content: 'User knows TypeScript' }];
       if (type === 'EPISODIC') return [{ content: 'User failed a similar task previously' }];
       return [];
    });

    const planner = new PlannerAgent(provider);
    const objective = 'Write a new app';
    await planner.plan(objective, 'user123');

    // memory should be queried twice
    expect(memoryService.searchSimilarMemories).toHaveBeenCalledTimes(2);

    // check that system prompt contains the memories
    const [[messages]] = spy.mock.calls;
    const systemMsg = messages.find((m: any) => m.role === 'system');

    expect(systemMsg?.content).toContain('User knows TypeScript');
    expect(systemMsg?.content).toContain('User failed a similar task previously');
  });
});
