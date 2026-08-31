import { prisma } from '@nova/database';

export async function storeMemory(
  userId: string,
  type: 'EPISODIC' | 'SEMANTIC',
  content: string,
  embedding: number[],
  taskId?: string
) {
  // Prisma doesn't natively support writing `Unsupported("vector")` directly via `.create()`.
  // We must use a raw SQL query.

  // Format the array into a vector string representation for pgvector
  const vectorString = `[${embedding.join(',')}]`;

  await prisma.$executeRaw`
    INSERT INTO "Memory" ("id", "userId", "type", "content", "embedding", "taskId", "createdAt")
    VALUES (
      gen_random_uuid(),
      ${userId},
      ${type},
      ${content},
      ${vectorString}::vector,
      ${taskId || null},
      NOW()
    )
  `;
}

export async function searchSimilarMemories(
  userId: string,
  embedding: number[],
  topK: number,
  type?: 'EPISODIC' | 'SEMANTIC'
) {
  const vectorString = `[${embedding.join(',')}]`;

  // We use pgvector cosine distance (<=>). Lower is closer.
  if (type) {
    return await prisma.$queryRaw<any[]>`
      SELECT id, type, content, "taskId", "createdAt",
             embedding <=> ${vectorString}::vector as distance
      FROM "Memory"
      WHERE "userId" = ${userId} AND type = ${type}
      ORDER BY embedding <=> ${vectorString}::vector ASC
      LIMIT ${topK}
    `;
  } else {
    return await prisma.$queryRaw<any[]>`
      SELECT id, type, content, "taskId", "createdAt",
             embedding <=> ${vectorString}::vector as distance
      FROM "Memory"
      WHERE "userId" = ${userId}
      ORDER BY embedding <=> ${vectorString}::vector ASC
      LIMIT ${topK}
    `;
  }
}
