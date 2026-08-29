import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLLMProvider } from './index';
import { MockProvider } from './mock';
import { OpenAIProvider } from './openai';

describe('createLLMProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should return MockProvider if provider is mock', () => {
    process.env.LLM_PROVIDER = 'mock';
    const provider = createLLMProvider();
    expect(provider).toBeInstanceOf(MockProvider);
  });

  it('should return MockProvider if no provider is set', () => {
    delete process.env.LLM_PROVIDER;
    const provider = createLLMProvider();
    expect(provider).toBeInstanceOf(MockProvider);
  });

  it('should return MockProvider and log warning if openai is requested but api key is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.LLM_PROVIDER = 'openai';
    delete process.env.LLM_API_KEY;
    const provider = createLLMProvider();

    expect(provider).toBeInstanceOf(MockProvider);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('LLM_PROVIDER is set to openai, but LLM_API_KEY is missing. Falling back to MockProvider.')
    );
  });

  it('should return OpenAIProvider if openai is requested and api key is present', () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.LLM_API_KEY = 'test-key';
    const provider = createLLMProvider();
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('should return MockProvider and log warning if unknown provider is requested', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.LLM_PROVIDER = 'anthropic';
    const provider = createLLMProvider();

    expect(provider).toBeInstanceOf(MockProvider);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown LLM_PROVIDER "anthropic". Falling back to MockProvider.')
    );
  });
});
