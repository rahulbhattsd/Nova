import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createTool } from './base';

const fileReaderSchema = z.object({
  filepath: z.string().min(1, "Filepath cannot be empty"),
});

const WORKSPACE_DIR = path.resolve(__dirname, '../../../../workspace-files');

export const fileReaderTool = createTool({
  name: 'fileReader',
  description: 'Reads the contents of a file in the workspace directory.',
  schema: fileReaderSchema,
  permissionLevel: 'READ',
  executeFn: async ({ filepath }) => {
    try {
      // 1. Resolve initial path
      const resolvedPath = path.resolve(WORKSPACE_DIR, filepath);

      // 2. Use realpath to resolve any symlinks, this will throw ENOENT if file doesn't exist
      const realPath = await fs.realpath(resolvedPath);

      // 3. Prevent path traversal (must be strictly inside WORKSPACE_DIR)
      const relative = path.relative(WORKSPACE_DIR, realPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Access denied: Cannot read files outside the workspace directory.`);
      }

      // 4. Read the file
      const content = await fs.readFile(realPath, 'utf-8');
      return { content };
    } catch (error: any) {
      if (error.message.includes('Access denied')) {
        throw error;
      }
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filepath}`);
      }
      if (error.code === 'EISDIR') {
          throw new Error(`Cannot read directory as file: ${filepath}`);
      }
      throw new Error(`Error reading file: ${error.message}`);
    }
  }
});
