import { LLMProvider } from './interfaces';
import { MockProvider } from './mock';
import { OpenAIProvider } from './openai';

export function createLLMProvider(): LLMProvider {
  const providerType = process.env.LLM_PROVIDER || 'mock';
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'gpt-4o';

  if (providerType === 'openai') {
    if (!apiKey) {
      console.warn('LLM_PROVIDER is set to openai, but LLM_API_KEY is missing. Falling back to MockProvider.');
      return new MockProvider();
    }
    return new OpenAIProvider(apiKey, model);
  }

  if (providerType === 'mock') {
    return new MockProvider();
  }

  console.warn(`Unknown LLM_PROVIDER "${providerType}". Falling back to MockProvider.`);
  return new MockProvider();
}

export * from './interfaces';
