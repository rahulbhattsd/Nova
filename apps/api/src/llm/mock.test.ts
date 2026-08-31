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

  it('should generate a deterministic vector of length 1536', async () => {
    const provider = new MockProvider();
    const text1 = 'hello world';
    const text2 = 'hello world';
    const text3 = 'different text';

    const vector1 = await provider.embed(text1);
    const vector2 = await provider.embed(text2);
    const vector3 = await provider.embed(text3);

    expect(vector1).toHaveLength(1536);
    expect(vector2).toHaveLength(1536);
    expect(vector3).toHaveLength(1536);

    // Deterministic check
    expect(vector1).toEqual(vector2);

    // Different strings should yield different vectors (unless there's a highly unlikely collision)
    expect(vector1).not.toEqual(vector3);
  });
});