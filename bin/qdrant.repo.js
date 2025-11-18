"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QdrantRepository = void 0;
const qdrant_connector_1 = require("./qdrant-connector");
class QdrantRepository {
    constructor(collection, embeddings, dim = 768) {
        (0, qdrant_connector_1.getQdrantClient)();
        this.collection = collection;
        this.embeddings = embeddings;
        this.dim = dim;
    }
    async ensureCollection() {
        await (0, qdrant_connector_1.ensureCollection)(this.collection, this.dim);
    }
    buildFundContent(r) {
        const aliases = Array.isArray(r.aliases) ? r.aliases : [];
        const industries = Array.isArray(r.industries) ? r.industries : [];
        const parts = [];
        parts.push(`Fund Name: ${r.name ?? 'Fund'}`);
        if (aliases.length)
            parts.push(`Aliases: ${aliases.join(', ')}`);
        if (r.status)
            parts.push(`Status: ${r.status}`);
        if (r.vintage != null)
            parts.push(`Vintage: ${r.vintage}`);
        if (r.strategy)
            parts.push(`Strategy: ${r.strategy}`);
        if (r.strategyGroup)
            parts.push(`Strategy Group: ${r.strategyGroup}`);
        if (r.geography)
            parts.push(`Geography: ${r.geography}`);
        if (r.geographyGroup)
            parts.push(`Geography Group: ${r.geographyGroup}`);
        if (industries.length)
            parts.push(`Industries: ${industries.join(', ')}`);
        if (r.fundSize != null)
            parts.push(`Fund Size: ${r.fundSize}M`);
        if (r.targetSize != null)
            parts.push(`Target Size: ${r.targetSize}M`);
        return parts.join('\n');
    }
    toDocument(p) {
        const r = (p.payload || {});
        const name = r.name ?? String(r._id ?? p.id);
        const title = r.vintage != null ? `${name} (${r.vintage})` : name;
        return {
            id: Number(p.id),
            createdAt: r.createdAt ?? new Date().toISOString(),
            title,
            content: this.buildFundContent(r),
            ...r,
        };
    }
    /*
      private genNumericId(): number {
        const high = Date.now();
        const low = Math.floor(Math.random() * 1000);
        return high * 1000 + low;
      }
     */
    async insertFund(fund) {
        await this.ensureCollection();
        //  const id = this.genNumericId();
        // @ts-ignore
        const aliases = (fund.names || []).map((alias) => alias.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim());
        fund.aliases = [...new Set(aliases)];
        delete fund.names;
        const payload = fund;
        delete payload.fundType;
        delete payload.id;
        const name = payload.name;
        const title = payload.vintage != null ? `${name} (${payload.vintage})` : name;
        const embeddingText = this.buildFundContent(payload);
        const vector = await this.embeddings.generateDocumentEmbedding(title, embeddingText);
        return (0, qdrant_connector_1.upsertPoints)(this.collection, [{ vector, payload, embeddingText }]);
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
    async getAllDocuments(limit = 100) {
        await this.ensureCollection();
        const res = await (0, qdrant_connector_1.scrollPoints)(this.collection, {
            with_payload: true,
            with_vector: false,
            limit,
        });
        const pts = res?.points ?? res?.result?.points ?? [];
        return pts.map((p) => this.toDocument(p));
    }
    async deleteDocument(id) {
        await this.ensureCollection();
        await (0, qdrant_connector_1.deletePoints)(this.collection, [id]);
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
    async getStats() {
        await this.ensureCollection();
        const documents = await (0, qdrant_connector_1.countPoints)(this.collection, true);
        // We can approximate embeddings as all points that have a vector; Qdrant does not expose a direct count, so reuse documents
        return { documents, embeddings: documents, orphaned_documents: 0 };
    }
    async searchSimilar(query, topK = 10) {
        await this.ensureCollection();
        const vector = await this.embeddings.generateQueryEmbedding(query);
        const res = await (0, qdrant_connector_1.searchPoints)(this.collection, vector, topK, true);
        const hits = res?.result ?? res ?? [];
        return hits.map((h) => ({ ...this.toDocument({ id: h.id, payload: h.payload }), distance: h.score }));
    }
}
exports.QdrantRepository = QdrantRepository;
//# sourceMappingURL=qdrant.repo.js.map