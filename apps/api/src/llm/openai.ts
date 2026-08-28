import OpenAI from 'openai';
import { prisma } from '@nova/database';
import { LLMCompletionOptions, LLMMessage, LLMProvider, LLMResponse, LLMStructuredResponse, StructuredOutputOptions } from './interfaces';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string = 'gpt-4o') {
    this.client = new OpenAI({ apiKey });
    this.defaultModel = defaultModel;
  }

  private mapMessages(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    })) as OpenAI.Chat.ChatCompletionMessageParam[];
  }

  private async recordUsage(
    model: string,
    inputTokens: number,
    outputTokens: number
  ) {
    // Basic cost estimation (very rough, actual per-model costs vary)
    const estimatedCost = (inputTokens / 1000) * 0.005 + (outputTokens / 1000) * 0.015;

    await prisma.usageRecord.create({
      data: {
        model,
        inputTokens,
        outputTokens,
        estimatedCost,
      },
    });
  }

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMResponse> {
    const model = options?.model || this.defaultModel;
    const response = await this.client.chat.completions.create({
      model,
      messages: this.mapMessages(messages),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    const content = response.choices[0]?.message?.content || '';
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;

    await this.recordUsage(model, inputTokens, outputTokens);

    return {
      content,
      model,
      inputTokens,
      outputTokens,
    };
  }

  async completeStructured<T>(
    messages: LLMMessage[],
    structuredOptions: StructuredOutputOptions<T>,
    options?: LLMCompletionOptions
  ): Promise<LLMStructuredResponse<T>> {
    const model = options?.model || this.defaultModel;

    // Convert generic JSON schema to OpenAI response format if needed.
    // OpenAI supports explicit JSON Schema in structured outputs.
    const response = await this.client.chat.completions.create({
      model,
      messages: this.mapMessages(messages),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: structuredOptions.name,
          description: structuredOptions.description,
          schema: structuredOptions.schema,
          strict: true,
        },
      },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;

    await this.recordUsage(model, inputTokens, outputTokens);

    let parsed: T;
    try {
      parsed = JSON.parse(content) as T;
    } catch (err) {
      throw new Error('Failed to parse structured output from OpenAI: ' + content);
    }

    return {
      parsed,
      model,
      inputTokens,
      outputTokens,
    };
  }

  async *stream(messages: LLMMessage[], options?: LLMCompletionOptions): AsyncGenerator<string, void, unknown> {
    const model = options?.model || this.defaultModel;
    const stream = await this.client.chat.completions.create({
      model,
      messages: this.mapMessages(messages),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    });

    // We can't track exact tokens from stream easily without `stream_options.include_usage: true`
    // and manual accumulation, but we will support basic usage tracking if present.
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield content;
      }

      if ((chunk as any).usage) {
        inputTokens = (chunk as any).usage.prompt_tokens;
        outputTokens = (chunk as any).usage.completion_tokens;
      }
    }

    // In a real implementation we might accumulate chunk counts if usage isn't provided,
    // but OpenAI does provide it if requested (though not in the standard types sometimes).
    if (inputTokens > 0 || outputTokens > 0) {
      await this.recordUsage(model, inputTokens, outputTokens);
    }
  }
}
