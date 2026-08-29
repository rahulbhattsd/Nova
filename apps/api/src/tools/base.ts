import { Tool } from '@nova/agent-core';
import { z } from 'zod';
import { PrismaClient } from '@nova/database';

const prisma = new PrismaClient();

export interface BaseToolConfig<T extends z.ZodTypeAny> {
  name: string;
  description: string;
  schema: T;
  permissionLevel: 'READ' | 'WRITE' | 'EXECUTE' | 'EXTERNAL_ACTION';
  timeout?: number; // milliseconds
  executeFn: (input: z.infer<T>) => Promise<any>;
}

export function createTool<T extends z.ZodTypeAny>(config: BaseToolConfig<T>): Tool {
  const defaultTimeout = 10000; // 10 seconds default

  return {
    name: config.name,
    description: config.description,
    inputSchema: config.schema,
    permissionLevel: config.permissionLevel,
    timeout: config.timeout,
    execute: async (input: any) => {
      const startTime = Date.now();
      // Temporary extraction since `@nova/agent-core` doesn't pass it yet natively in this phase.
      // We accept it from the test/callers via an implicit pattern, or default to null.
      const taskId = input?._taskId || null;
      if (input && typeof input === 'object' && '_taskId' in input) {
         delete input._taskId;
      }
      let output: any = null;
      let errorStr: string | null = null;
      let status: string = 'SUCCESS';

      try {
        // 1. Validate input
        const parseResult = config.schema.safeParse(input);
        if (!parseResult.success) {
          throw new Error(`Validation Error: ${parseResult.error.message}`);
        }

        const validInput = parseResult.data;

        // 2. Execute with timeout
        const timeoutMs = config.timeout || defaultTimeout;
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs);
        });

        output = await Promise.race([
          config.executeFn(validInput),
          timeoutPromise
        ]);

      } catch (err: any) {
        status = 'FAILED';
        errorStr = err instanceof Error ? err.message : String(err);
      } finally {
        const duration = Date.now() - startTime;

        // 3. Log execution
        try {
          await prisma.toolExecution.create({
            data: {
              toolName: config.name,
              input: JSON.parse(JSON.stringify(input || {})),
              output: output ? JSON.parse(JSON.stringify(output)) : null,
              error: errorStr,
              status,
              duration,
              taskId: taskId || null,
            }
          });
        } catch (logErr) {
          console.error(`Failed to log tool execution for ${config.name}:`, logErr);
        }
      }

      // 4. Return structured error or success payload
      if (status === 'FAILED') {
        return { error: errorStr || 'Unknown error' };
      }

      return output;
    }
  };
}
