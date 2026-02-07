import { openDB } from 'idb';

export interface AIMemory {
  id: string; // unique id
  text: string;
  tags?: string[];
  createdAt: string;
}

let dbPromise: Promise<any> | null = null;

export function getDB(): Promise<any> {
  if (!dbPromise) {
    dbPromise = openDB<any>('ai_memory', 1, {
      upgrade(db) {
        const store = db.createObjectStore('memories', { keyPath: 'id' });
        store.createIndex('by-createdAt', 'createdAt');
      },
    });
  }
  return dbPromise;
}

export async function listMemories(): Promise<AIMemory[]> {
  const db = await getDB();
  return (await db.getAll('memories')) as AIMemory[];
}

export async function deleteMemory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('memories', id);
}

export async function clearMemories(): Promise<void> {
  const db = await getDB();
  await db.clear('memories');
}

export async function addMemory(memory: AIMemory): Promise<void> {
  const db = await getDB();
  await db.put('memories', memory);
} 
