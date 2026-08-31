export interface StructuredOutputOptions<T = any> {
  schema: any; // JSON schema or similar
  name: string;
  description?: string;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMStructuredResponse<T> {
  parsed: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMProvider {
  /**
   * Send a message and get a string response
   */
  complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMResponse>;

  /**
   * Send a message and get a structured response matching the schema
   */
  completeStructured<T>(
    messages: LLMMessage[],
    structuredOptions: StructuredOutputOptions<T>,
    options?: LLMCompletionOptions
  ): Promise<LLMStructuredResponse<T>>;

  /**
   * Send a message and get a streaming response
   */
  stream(messages: LLMMessage[], options?: LLMCompletionOptions): AsyncGenerator<string, void, unknown>;

  /**
   * Embed text into a vector
   */
  embed(text: string): Promise<number[]>;
}
