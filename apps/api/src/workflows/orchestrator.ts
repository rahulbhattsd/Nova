import { PrismaClient } from '@nova/database';
import { TaskStatus, ExecutionContext } from '@nova/agent-core';
import { registry } from '../tools/registry';
import { createLLMProvider } from '../llm';
import { storeMemory } from '../services/memory';

const prisma = new PrismaClient();

export async function executeTask(taskId: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { steps: { orderBy: { order: 'asc' } } }
    });

    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }

    if (task.status !== TaskStatus.READY && task.status !== TaskStatus.PENDING) {
       console.log(`Task ${taskId} is not in a runnable state (${task.status})`);
       return;
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.RUNNING }
    });

    const llm = createLLMProvider();

    // We can assume a default budget and retries for this phase
    const maxRetries = 3;
    const context: ExecutionContext = {
      taskId: task.id,
      userId: task.userId,
      budget: 100, // Default budget
      retries: 0,
      maxRetries
    };

    const taskHistory: string[] = [];

    for (const step of task.steps) {
      if (context.budget <= 0) {
        console.warn(`Task ${taskId} exhausted its budget. Stopping execution.`);
        await prisma.task.update({
          where: { id: taskId },
          data: { status: TaskStatus.FAILED }
        });
        return;
      }

      context.currentStepId = step.id;
      context.retries = 0; // Reset retries per step

      await prisma.taskStep.update({
        where: { id: step.id },
        data: { status: TaskStatus.RUNNING, startedAt: new Date() }
      });

      let stepSuccess = false;

      while (context.retries <= context.maxRetries) {
        try {
          // Use LLM to determine tool and inputs based on step description and registered tools
          const availableTools = registry.getAllTools().map(t => ({
             name: t.name,
             description: t.description,
             schema: t.inputSchema // z.ZodType isn't directly serializable to LLM schema easily, but we'll use a simplified mapping for this phase
          }));

          // Construct schema for LLM structured output
          const toolSelectionSchema = {
             type: 'object',
             properties: {
               toolName: { type: 'string', description: 'The name of the tool to execute' },
               input: { type: 'object', description: 'The input arguments for the tool' }
             },
             required: ['toolName', 'input'],
             additionalProperties: false
          };

          let systemPrompt = 'You are an orchestrator agent. Select the best tool and determine its input to accomplish the user\'s task step. Available tools:\n' + availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n');
          if (taskHistory.length > 0) {
            systemPrompt += '\n\nPrevious steps context:\n' + taskHistory.join('\n');
          }

          const messages = [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: `Task Step: ${step.description}` }
          ];

          const llmResponse = await llm.completeStructured<{ toolName: string, input: any }>(
            messages,
            { name: 'ToolSelection', schema: toolSelectionSchema }
          );

          const { toolName, input } = llmResponse.parsed;
          const tool = registry.getTool(toolName);

          if (!tool) {
            throw new Error(`Tool ${toolName} selected by LLM is not registered.`);
          }

          // Execute Tool
          const result = await tool.execute(input, context);

          if (result && result.error) {
             throw new Error(result.error);
          }

          // Cost simulation for the sake of enforcing budget
          context.budget -= 10;

          // Step completed successfully
          await prisma.taskStep.update({
            where: { id: step.id },
            data: { status: TaskStatus.COMPLETED, completedAt: new Date() }
          });

          taskHistory.push(`Step: ${step.description} - Result: Success - Output: ${JSON.stringify(result?.output || {})}`);

          stepSuccess = true;
          break; // Break retry loop

        } catch (err: any) {
           console.error(`Step ${step.id} failed (attempt ${context.retries}):`, err);
           context.retries++;

           if (context.retries > context.maxRetries) {
              await prisma.taskStep.update({
                 where: { id: step.id },
                 data: { status: TaskStatus.FAILED, error: err.message || String(err), completedAt: new Date() }
              });
              taskHistory.push(`Step: ${step.description} - Result: Failed - Error: ${err.message || String(err)}`);
              break; // Break retry loop, step failed
           } else {
              await prisma.taskStep.update({
                 where: { id: step.id },
                 data: { status: TaskStatus.RETRYING }
              });
           }
        }
      }

      if (!stepSuccess) {
         // Task failed due to step failure past maxRetries
         // TODO: Phase 13 - route to WAITING_APPROVAL if blocked
         await prisma.task.update({
           where: { id: taskId },
           data: { status: TaskStatus.FAILED }
         });

         const outcome = `User previously attempted ${task.objective} - result: FAILED. Steps taken: ${taskHistory.join('; ')}`;
         const embedding = await llm.embed(outcome);
         await storeMemory(task.userId, 'EPISODIC', outcome, embedding, task.id);

         return;
      }
    }

    // All steps completed successfully
    // TODO: Phase 12 - real verification (Critic agent) should happen here.
    // For now, all steps COMPLETED -> Task COMPLETED.
    await prisma.task.update({
       where: { id: taskId },
       data: { status: TaskStatus.COMPLETED }
    });

    const outcome = `User previously attempted ${task.objective} - result: COMPLETED. Steps taken: ${taskHistory.join('; ')}`;
    const embedding = await llm.embed(outcome);
    await storeMemory(task.userId, 'EPISODIC', outcome, embedding, task.id);

  } catch (error) {
     console.error(`Orchestrator error for task ${taskId}:`, error);
     await prisma.task.update({
       where: { id: taskId },
       data: { status: TaskStatus.FAILED }
     });
  }
}
