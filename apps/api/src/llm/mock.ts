import { LLMCompletionOptions, LLMMessage, LLMProvider, LLMResponse, LLMStructuredResponse, StructuredOutputOptions } from './interfaces';

export class MockProvider implements LLMProvider {
  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMResponse> {
    return {
      content: 'This is a deterministic mock response.',
      model: options?.model || 'mock-model',
      inputTokens: 10,
      outputTokens: 20,
    };
  }

  async completeStructured<T>(
    messages: LLMMessage[],
    structuredOptions: StructuredOutputOptions<T>,
    options?: LLMCompletionOptions
  ): Promise<LLMStructuredResponse<T>> {
    // Generate a deterministic mock based on the schema requested, if possible.
    // For simplicity, we just return an empty object or a generic mock.
    // In a real mock, you might use the schema to generate deterministic matching objects.

    // We try to return a valid object if we assume the user provides a type parameter T
    return {
      parsed: {} as T, // Return an empty object by default. More advanced mocking could try to parse schema.
      model: options?.model || 'mock-model',
      inputTokens: 15,
      outputTokens: 25,
    };
  }

  async *stream(messages: LLMMessage[], options?: LLMCompletionOptions): AsyncGenerator<string, void, unknown> {
    const chunks = ['This ', 'is ', 'a ', 'streaming ', 'mock ', 'response.'];
    for (const chunk of chunks) {
      yield chunk;
      // Optional: add a tiny delay to simulate network latency if needed, but omitted for faster tests.
    }
  }

  async embed(text: string): Promise<number[]> {
    // Generate a deterministic mock vector of length 1536 based on string content
    const vector = new Array(1536).fill(0);
    for (let i = 0; i < text.length; i++) {
      const val = text.charCodeAt(i) / 255.0;
      vector[i % 1536] = (vector[i % 1536] + val) / 2.0;
    }

    // Normalize mock vector
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map(v => v / magnitude);
  }
}
