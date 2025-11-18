import type { IOFundModel } from './fund.types';
import { EmbeddingsService } from './embeddings.service';
import {
  getQdrantClient,
  ensureCollection as ensureQdrantCollection,
  upsertPoints,
  scrollPoints,
  searchPoints,
  deletePoints as deleteQdrantPoints,
  countPoints,
  retrievePoint,
} from './qdrant-connector';

export type Document = IOFundModel & { id: number; createdAt: string; title?: string; content?: string };

interface QdrantPoint {
  id: number;
  vector?: number[];
  payload?: Record<string, any>;
}

export class QdrantRepository {
  private collection: string;
  private embeddings: EmbeddingsService;
  private dim: number;

  constructor(collection: string, embeddings: EmbeddingsService, dim: number = 768) {
    
    getQdrantClient();
    this.collection = collection;
    this.embeddings = embeddings;
    this.dim = dim;
  }

  async ensureCollection(): Promise<void> {
    await ensureQdrantCollection(this.collection, this.dim);
  }

  private buildFundContent(r: Partial<IOFundModel> & { name?: string }): string {
    const aliases = Array.isArray((r as any).aliases) ? (r as any).aliases as string[] : [];
    const industries = Array.isArray(r.industries) ? r.industries : [];
    const parts: string[] = [];
    parts.push(`Fund Name: ${r.name ?? 'Fund'}`);
    if (aliases.length) parts.push(`Aliases: ${aliases.join(', ')}`);
    if (r.status) parts.push(`Status: ${r.status}`);
    if (r.vintage != null) parts.push(`Vintage: ${r.vintage}`);
    if (r.strategy) parts.push(`Strategy: ${r.strategy}`);
     if (r.strategyGroup) parts.push(`Strategy Group: ${r.strategyGroup}`);
    if (r.geography) parts.push(`Geography: ${r.geography}`);
    if (r.geographyGroup) parts.push(`Geography Group: ${r.geographyGroup}`);
    if (industries.length) parts.push(`Industries: ${industries.join(', ')}`);
    if (r.fundSize != null) parts.push(`Fund Size: ${r.fundSize}M`);
    if (r.targetSize != null) parts.push(`Target Size: ${r.targetSize}M`);
    return parts.join('\n');
  }

  private toDocument(p: QdrantPoint): Document {
    const r = (p.payload || {}) as any;
    const name: string = r.name ?? String(r._id ?? p.id);
    const title = r.vintage != null ? `${name} (${r.vintage})` : name;
    return {
      id: Number(p.id),
      createdAt: r.createdAt ?? new Date().toISOString(),
      title,
      content: this.buildFundContent(r),
      ...r,
    } as Document;
  }
/* 
  private genNumericId(): number {
    const high = Date.now();
    const low = Math.floor(Math.random() * 1000);
    return high * 1000 + low;
  }
 */
  async insertFund(fund: IOFundModel): Promise<void> {
    await this.ensureCollection();
  //  const id = this.genNumericId();
      // @ts-ignore
    const aliases =     (fund.names || []).map((alias: string) => alias.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim());
  
    fund.aliases = [...new Set(aliases)] as any;
    delete (fund as any).names;
    const payload = fund as any;
    delete (payload as any).fundType;
    delete (payload as any).id;
    const name = payload.name;
    const title = payload.vintage != null ? `${name} (${payload.vintage})` : name;
    const embeddingText = this.buildFundContent(payload);
    
    const vector = await this.embeddings.generateDocumentEmbedding(title, embeddingText);
    
   return  upsertPoints(this.collection, [{vector, payload , embeddingText}]);
    
  }

/*   async generateAndStoreFundEmbeddingById(id: number): Promise<boolean> {
    try {
      await this.ensureCollection();
      const point: any = await retrievePoint(this.collection, id, true, true);
      if (!point) return false;
      const existingVector = point.vector;
      if (Array.isArray(existingVector) && existingVector.length > 0) return true; // already embedded
      const r = (point.payload || {}) as any;
      const name = r.name ?? String(r._id ?? id);
      const title = r.vintage != null ? `${name} (${r.vintage})` : name;
      const content = this.buildFundContent(r);
      const vector = await this.embeddings.generateDocumentEmbedding(title, content);
      if (!Array.isArray(vector) || vector.length === 0) return false;
      await upsertPoints(this.collection, [{vector, payload: r }]);
      return true;
    } catch (e) {
      return false;
    }
  } */

  async getAllDocuments(limit: number = 100): Promise<Document[]> {
    await this.ensureCollection();
    const res: any = await scrollPoints(this.collection, {
      with_payload: true,
      with_vector: false,
      limit,
    });
    const pts: QdrantPoint[] = res?.points ?? res?.result?.points ?? [];
    return pts.map((p) => this.toDocument(p));
  }

  async deleteDocument(id: number): Promise<boolean> {
    await this.ensureCollection();
    await deleteQdrantPoints(this.collection, [id]);
    return true;
  }

/*   async getEmbeddingByDocumentId(id: number): Promise<Float32Array | null> {
    await this.ensureCollection();
    const pt: any = await retrievePoint(this.collection, id, true);
    if (!pt) return null;
    const v = (pt as any).vector;
    // vector may be number[] or object with single key for named vector
    const arr: number[] | undefined = Array.isArray(v)
      ? v
      : (v && typeof v === 'object'
          ? (Array.isArray((Object.values(v)[0] as any)) ? (Object.values(v)[0] as number[]) : undefined)
          : undefined);
    return Array.isArray(arr) ? new Float32Array(arr) : null;
  } */

  async getStats(): Promise<{ documents: number; embeddings: number; orphaned_documents: number }> {
    await this.ensureCollection();
    const documents = await countPoints(this.collection, true);
    // We can approximate embeddings as all points that have a vector; Qdrant does not expose a direct count, so reuse documents
    return { documents, embeddings: documents, orphaned_documents: 0 };
  }

  async searchSimilar(query: string, topK: number = 10): Promise<Array<Document & { distance: number }>> {
    await this.ensureCollection();
    const vector = await this.embeddings.generateQueryEmbedding(query);
    const res: any = await searchPoints(this.collection, vector, topK, true);
    const hits: any[] = (res as any)?.result ?? res ?? [];
    return hits.map((h: any) => ({ ...this.toDocument({ id: h.id, payload: h.payload }), distance: h.score }));
  }
}
