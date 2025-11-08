import axios, { AxiosInstance } from 'axios';
import type { IOFundModel } from './fund.types';
import { EmbeddingsService } from './embeddings.service';

export type Document = IOFundModel & { id: number; createdAt: string; title?: string; content?: string };

interface QdrantPoint {
  id: number;
  vector?: number[];
  payload?: Record<string, any>;
}

export class QdrantRepository {
  private http: AxiosInstance;
  private collection: string;
  private embeddings: EmbeddingsService;
  private dim: number;

  constructor(baseUrl: string, collection: string, embeddings: EmbeddingsService, dim: number = 768) {
    if (!baseUrl) throw new Error('Qdrant base URL required');
    this.http = axios.create({ baseURL: baseUrl.replace(/\/$/, '') });
    this.collection = collection;
    this.embeddings = embeddings;
    this.dim = dim;
  }

  async ensureCollection(): Promise<void> {
    try {
      await this.http.get(`/collections/${this.collection}`);
      return;
    } catch {}
    await this.http.put(`/collections/${this.collection}`, {
      vectors: { size: this.dim, distance: 'Cosine' },
    });
  }

  private buildFundContent(r: Partial<IOFundModel> & { name?: string }): string {
    const aliases = Array.isArray((r as any).aliases) ? (r as any).aliases as string[] : [];
    const industries = Array.isArray(r.industries) ? r.industries : [];
    const parts: string[] = [];
    parts.push(`Name: ${r.name ?? 'Fund'}`);
    if (aliases.length) parts.push(`Aliases: ${aliases.join(', ')}`);
    if (r.status) parts.push(`Status: ${r.status}`);
    if (r.vintage != null) parts.push(`Vintage: ${r.vintage}`);
    if (r.strategy) parts.push(`Strategy: ${r.strategy}`);
    if (r.geography) parts.push(`Geography: ${r.geography}`);
    if (industries.length) parts.push(`Industries: ${industries.join(', ')}`);
    if (r.fundSize != null) parts.push(`Fund Size: ${r.fundSize}`);
    if (r.targetSize != null) parts.push(`Target Size: ${r.targetSize}`);
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

  private genNumericId(): number {
    const high = Date.now();
    const low = Math.floor(Math.random() * 1000);
    return high * 1000 + low;
  }

  async insertFund(fund: IOFundModel): Promise<number> {
    await this.ensureCollection();
    const id = this.genNumericId();
    const payload = { ...fund, createdAt: new Date().toISOString() } as any;
    delete (payload as any).id;
    await this.http.put(`/collections/${this.collection}/points`, {
      points: [{ id, payload }],
    });
    return id;
  }

  async generateAndStoreFundEmbeddingById(id: number): Promise<boolean> {
    try {
      await this.ensureCollection();
      const getRes = await this.http.post(`/collections/${this.collection}/points/scroll`, {
        filter: { must: [{ key: 'id', match: { value: id } }] },
        with_payload: true,
        with_vector: false,
        limit: 1,
      });
      const point: QdrantPoint | undefined = getRes.data?.result?.points?.[0];
      if (!point) return false;
      const r = (point.payload || {}) as any;
      const name = r.name ?? String(r._id ?? id);
      const title = r.vintage != null ? `${name} (${r.vintage})` : name;
      const content = this.buildFundContent(r);
      const vector = await this.embeddings.generateDocumentEmbedding(title, content);
      if (!Array.isArray(vector) || vector.length === 0) return false;
      await this.http.put(`/collections/${this.collection}/points`, {
        points: [{ id, vector, payload: r }],
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async getAllDocuments(limit: number = 100): Promise<Document[]> {
    await this.ensureCollection();
    const res = await this.http.post(`/collections/${this.collection}/points/scroll`, {
      with_payload: true,
      with_vector: false,
      limit,
    });
    const pts: QdrantPoint[] = res.data?.result?.points ?? [];
    return pts.map((p) => this.toDocument(p));
  }

  async deleteDocument(id: number): Promise<boolean> {
    await this.ensureCollection();
    const res = await this.http.post(`/collections/${this.collection}/points/delete`, { points: [id] });
    return Boolean(res.data?.status === 'ok');
  }

  async getEmbeddingByDocumentId(id: number): Promise<Float32Array | null> {
    await this.ensureCollection();
    const res = await this.http.get(`/collections/${this.collection}/points/${id}`, {
      params: { with_vector: true, with_payload: false },
    });
    const v: number[] | undefined = res.data?.result?.vector;
    return Array.isArray(v) ? new Float32Array(v) : null;
  }

  async getStats(): Promise<DatabaseStats> {
    await this.ensureCollection();
    const countRes = await this.http.post(`/collections/${this.collection}/points/count`, { exact: true });
    const documents = Number(countRes.data?.result?.count ?? 0);
    // We can approximate embeddings as all points that have a vector; Qdrant does not expose a direct count, so reuse documents
    return { documents, embeddings: documents, orphaned_documents: 0 };
  }

  async searchSimilar(query: string, topK: number = 10): Promise<Array<Document & { distance: number }>> {
    await this.ensureCollection();
    const vector = await this.embeddings.generateQueryEmbedding(query);
    const res = await this.http.post(`/collections/${this.collection}/points/search`, {
      vector,
      limit: topK,
      with_payload: true,
      with_vector: false,
    });
    const hits = res.data?.result ?? [];
    return hits.map((h: any) => ({ ...this.toDocument({ id: h.id, payload: h.payload }), distance: h.score }));
  }
}

