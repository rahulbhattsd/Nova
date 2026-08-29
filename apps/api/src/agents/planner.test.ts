import { describe, it, expect, vi } from 'vitest';
import { PlannerAgent } from './planner';
import { MockProvider } from '../llm/mock';
import { LLMMessage, StructuredOutputOptions, LLMCompletionOptions, LLMStructuredResponse } from '../llm/interfaces';

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
  it('should generate a structured plan for a given objective', async () => {
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
    expect(output.plan[0].description).toBe('Step 1: Do something');
    expect(output.plan[0].order).toBe(1);
  });
});
