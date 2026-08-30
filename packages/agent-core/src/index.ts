export enum TaskStatus {
  PENDING = 'PENDING',
  PLANNING = 'PLANNING',
  READY = 'READY',
  RUNNING = 'RUNNING',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
  VERIFYING = 'VERIFYING',
  RETRYING = 'RETRYING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemInstructions: string;
  allowedTools: string[];
  memoryAccess: boolean;
  executionPolicy: any; // Type to be defined later
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: any; // Type to be defined later, perhaps JSON Schema
  execute: (input: any, context?: ExecutionContext) => Promise<any>;
  permissionLevel: 'READ' | 'WRITE' | 'EXECUTE' | 'EXTERNAL_ACTION';
  timeout?: number; // in milliseconds
}

export interface Task {
  id: string;
  userId: string;
  objective: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  steps: TaskStep[];
}

export interface TaskStep {
  id: string;
  taskId: string;
  description: string;
  status: TaskStatus;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  agentId?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface ExecutionContext {
  taskId: string;
  userId: string;
  currentStepId?: string;
  budget: number;
  retries: number;
  maxRetries: number;
}

export interface AgentResult {
  success: boolean;
  output: any;
  error?: string;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
}
