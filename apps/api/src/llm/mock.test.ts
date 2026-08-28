import { describe, it, expect } from 'vitest';
import { MockProvider } from './mock';

describe('MockProvider', () => {
  const provider = new MockProvider();

  it('should return a deterministic string for complete()', async () => {
    const res = await provider.complete([{ role: 'user', content: 'hello' }]);
    expect(res.content).toBe('This is a deterministic mock response.');
    expect(res.model).toBe('mock-model');
    expect(res.inputTokens).toBe(10);
    expect(res.outputTokens).toBe(20);
  });

  it('should return deterministic data for completeStructured()', async () => {
    const res = await provider.completeStructured(
      [{ role: 'user', content: 'hello' }],
      { schema: {}, name: 'test' }
    );
    expect(res.parsed).toEqual({});
    expect(res.model).toBe('mock-model');
    expect(res.inputTokens).toBe(15);
    expect(res.outputTokens).toBe(25);
  });

  it('should stream deterministic chunks for stream()', async () => {
    const generator = provider.stream([{ role: 'user', content: 'hello' }]);
    const chunks: string[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }
    expect(chunks.join('')).toBe('This is a streaming mock response.');
  });
});
