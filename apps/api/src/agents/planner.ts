import { LLMProvider } from '../llm/interfaces';
import { Agent, TaskStep, TaskStatus } from '@nova/agent-core';

export interface PlanStep {
  description: string;
  order: number;
}

export interface PlannerOutput {
  plan: PlanStep[];
}

export class PlannerAgent implements Agent {
  id = 'planner';
  name = 'Planner';
  description = 'Creates a structured, step-by-step plan for a given objective.';
  systemInstructions = 'You are a Planner agent. Your job is to take a natural-language objective and break it down into a logical sequence of actionable steps. Output ONLY valid JSON matching the schema provided, with no extra text or markdown wrappers.';
  allowedTools = [];
  memoryAccess = false;
  executionPolicy = 'autonomous';

  constructor(private llmProvider: LLMProvider) {}

  async plan(objective: string): Promise<PlannerOutput> {
    const messages = [
      { role: 'system' as const, content: this.systemInstructions },
      { role: 'user' as const, content: `Objective: ${objective}` }
    ];

    const schema = {
      type: 'object',
      properties: {
        plan: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Detailed description of the step' },
              order: { type: 'number', description: 'The sequential order of the step, starting from 1' }
            },
            required: ['description', 'order']
          },
          description: 'The step-by-step plan'
        }
      },
      required: ['plan'],
      additionalProperties: false
    };

    const response = await this.llmProvider.completeStructured<PlannerOutput>(
      messages,
      {
        name: 'plan',
        description: 'A step-by-step plan to achieve the objective',
        schema: schema
      }
    );

    return response.parsed;
  }
}
