import { QdrantClient } from '@qdrant/js-client-rest';
import { ensureQdrantRunning } from './qdrant-runner';

let clientSingleton: QdrantClient | null = null;

const URL_QDRANT = 'http://127.0.0.1:6333';

export function getQdrantClient(): QdrantClient {
  if (!clientSingleton) {
    const url = URL_QDRANT;
    void ensureQdrantRunning(url).catch(() => {});
    clientSingleton = new QdrantClient({ url });
  }
  return clientSingleton;
}

export async function ensureCollection(collection: string, dim: number = 768): Promise<void> {
  const client = getQdrantClient();
  try {
    await client.getCollection(collection);
    return;
  } catch {
    // fallthrough to create
  }
  await client.createCollection(collection, {
    vectors: { size: dim, distance: 'Cosine' },
  } as any);
}

export async function dropAndCreateCollection(collection: string, dim: number = 768): Promise<void> {
  const client = getQdrantClient();
  try {
    await client.deleteCollection(collection);
  } catch {
    // ignore if not exists
  }
  await client.createCollection(collection, {
    vectors: { size: dim, distance: 'Cosine' },
  } as any);
}

export type UpsertPoint = { id: number; vector?: number[]; payload?: Record<string, any> };

export async function upsertPoints(collection: string, points: UpsertPoint[]): Promise<void> {
  const client = getQdrantClient();
  await client.upsert(collection, { points } as any);
}

export async function searchPoints(collection: string, vector: number[], limit: number, with_payload: boolean = true) {
  const client = getQdrantClient();
  return client.search(collection, { vector, limit, with_payload } as any);
}

export async function scrollPoints(collection: string, params: any) {
  const client = getQdrantClient();
  return client.scroll(collection, params);
}

export async function deletePoints(collection: string, ids: Array<number | string>): Promise<void> {
  const client = getQdrantClient();
  await client.delete(collection, { points: ids } as any);
}

export async function countPoints(collection: string, exact: boolean = true): Promise<number> {
  const client = getQdrantClient();
  const res = await client.count(collection, { exact } as any);
  return Number((res as any)?.count ?? (res as any)?.result?.count ?? 0);
}

export async function retrievePoint(
  collection: string,
  id: number | string,
  with_vector: boolean = true,
  with_payload: boolean = true
) {
  const client = getQdrantClient();
  const res = await client.retrieve(collection, { ids: [id], with_vector, with_payload } as any);
  const arr = (res as any) ?? [];
  return Array.isArray(arr) ? arr[0] : null;
}
