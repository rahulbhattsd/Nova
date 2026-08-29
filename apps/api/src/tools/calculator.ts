import { z } from 'zod';
import * as math from 'mathjs';
import { createTool } from './base';

const calculatorSchema = z.object({
  expression: z.string().min(1, "Expression cannot be empty"),
});

export const calculatorTool = createTool({
  name: 'calculator',
  description: 'Evaluates a mathematical expression safely.',
  schema: calculatorSchema,
  permissionLevel: 'READ', // No side effects
  timeout: 1000, // Should be fast
  executeFn: async ({ expression }) => {
    try {
      // Evaluate the expression safely using mathjs
      const result = math.evaluate(expression);

      // Simplify the result checking for demonstration/tool purposes
      if (typeof result !== 'number' && typeof result !== 'boolean' && result?.constructor?.name !== 'Complex') {
          throw new Error('Expression must evaluate to a number, boolean, or complex type.');
      }

      // Specifically catch dividing by zero which returns Infinity or NaN in JS/mathjs depending on context
      if (typeof result === 'number' && !isFinite(result)) {
         throw new Error('Division by zero or invalid operation resulting in Infinity/NaN.');
      }

      return { result };
    } catch (error: any) {
      if (error.message.includes('Infinity') || error.message.includes('NaN')) {
          throw error;
      }
      if (error.message.includes('Undefined symbol')) {
          throw new Error(`Invalid syntax or unsupported operation: ${error.message}`);
      }
      if (error.message.includes('Unexpected type')) {
          throw new Error(`Invalid syntax: ${error.message}`);
      }

      throw new Error(`Math evaluation error: ${error.message}`);
    }
  }
});
