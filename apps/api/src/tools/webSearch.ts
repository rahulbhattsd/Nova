import { z } from 'zod';
import { createTool } from './base';

const webSearchSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  maxResults: z.number().int().min(1).max(20).optional().default(5),
});

export interface SearchResult {
  url: string;
  title: string;
  retrievedAt: string;
  content: string;
}

export interface SearchProvider {
  search(query: string, maxResults: number): Promise<SearchResult[]>;
}

// Tavily Provider
export class TavilySearchProvider implements SearchProvider {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.SEARCH_API_KEY;
  }

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    if (!this.apiKey) {
      throw new Error('Web search is not configured (SEARCH_API_KEY is missing)');
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        query: query,
        max_results: maxResults,
        search_depth: "basic",
        include_answer: false,
        include_images: false,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
        throw new Error(`Tavily search provider failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const now = new Date().toISOString();

    return (data.results || []).map((result: any) => ({
      url: result.url,
      title: result.title,
      retrievedAt: now,
      content: result.content,
    }));
  }
}

// Mock Provider for testing
export class MockSearchProvider implements SearchProvider {
    public throwError = false;
    public requireKey = true;

    async search(query: string, maxResults: number): Promise<SearchResult[]> {
      if (this.requireKey && !process.env.SEARCH_API_KEY) {
          throw new Error('Web search is not configured (SEARCH_API_KEY is missing)');
      }

      if (this.throwError) {
          throw new Error('Tavily search provider failed: 500 Internal Server Error');
      }

      const results: SearchResult[] = [];
      const now = new Date().toISOString();

      for (let i=0; i<maxResults; i++) {
          results.push({
              url: `https://mock.example.com/result-${i+1}`,
              title: `Mock Result ${i+1} for ${query}`,
              retrievedAt: now,
              content: `This is a mock snippet for result ${i+1}.`
          });
      }

      return results;
    }
}


// Determine which provider to use. Let tests override this via env or injection if needed.
let currentProvider: SearchProvider = process.env.NODE_ENV === 'test'
  ? new MockSearchProvider()
  : new TavilySearchProvider();

// Helper for tests
export function _setSearchProvider(provider: SearchProvider) {
    currentProvider = provider;
}

export const webSearchTool = createTool({
  name: 'webSearch',
  description: 'Searches the web for the given query and returns relevant results.',
  schema: webSearchSchema,
  permissionLevel: 'READ',
  timeout: 30000, // 30 seconds max
  executeFn: async ({ query, maxResults }) => {
    const results = await currentProvider.search(query, maxResults);
    return { results };
  }
});
