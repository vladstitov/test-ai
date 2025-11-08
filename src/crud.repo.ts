import Database from 'better-sqlite3';
import { EmbeddingsService } from './embeddings.service';
import type { IOFundModel } from './fund.types';

// ========================================
// TYPES AND INTERFACES
// ========================================

export type Document = IOFundModel & {
  id: number;
  createdAt: string;
  title?: string;
  content?: string;
};

export interface DatabaseStats {
  documents: number;
  embeddings: number;
  orphaned_documents: number;
}

export interface DatabaseSchema {
  tables: {
    documents: {
      columns: string[];
      description: string;
    };
    embeddings: {
      columns: string[];
      description: string;
    };
  };
  relationships: string[];
  indexes: string[];
}

// ========================================
// CRUD REPOSITORY CLASS
// ========================================

export class CrudRepository {
  private db: Database.Database;
  private embeddingsService: EmbeddingsService;

  constructor(dbInstance: Database.Database, embeddingsService: EmbeddingsService) {
    if (!dbInstance) throw new Error('Database instance is required');
    if (!embeddingsService) throw new Error('EmbeddingsService instance is required');
    this.db = dbInstance;
    this.embeddingsService = embeddingsService;

    // Verify sqlite-vec availability
    try {
      this.db.exec('SELECT vec_version()');
      console.log('[INFO] sqlite-vec extension detected - using native vector operations');
    } catch {
      throw new Error('sqlite-vec extension is required for embeddings but not available');
    }
  }

  // Helper: parse JSON array string into string[] safely
  private parseJsonList(jsonStr?: string): string[] {
    if (!jsonStr) return [];
    try {
      const arr = JSON.parse(jsonStr);
      return Array.isArray(arr) ? arr.map((x: any) => String(x)) : [];
    } catch {
      return [];
    }
  }

  // Helper: build a readable content string from a funds row
  private buildFundContent(
    r: {
      name?: string;
      aliases?: string;
      manager?: string;
      status?: string;
      vintage?: number;
      strategy?: string;
      geography?: string;
      industries?: string;
      fundSize?: number;
      targetSize?: number;
    },
    opts: { includeName?: boolean } = {}
  ): string {
    const { includeName = true } = opts;
    const aliases = this.parseJsonList(r.aliases);
    const industries = this.parseJsonList(r.industries);
    const parts: string[] = [];
    if (includeName) parts.push(`Name: ${r.name ?? 'Fund'}`);
    if (aliases.length) parts.push(`Aliases: ${aliases.join(', ')}`);
    if (r.manager) parts.push(`Manager: ${r.manager}`);
    if (r.status) parts.push(`Status: ${r.status}`);
    if (r.vintage != null) parts.push(`Vintage: ${r.vintage}`);
    if (r.strategy) parts.push(`Strategy: ${r.strategy}`);
    if (r.geography) parts.push(`Geography: ${r.geography}`);
    if (industries.length) parts.push(`Industries: ${industries.join(', ')}`);
    if (r.fundSize != null) parts.push(`Fund Size: ${r.fundSize}`);
    if (r.targetSize != null) parts.push(`Target Size: ${r.targetSize}`);
    return parts.join('\n');
  }

  // Helper: map a funds row to a Document-like object
  private fundRowToDocument(r: { id: number; createdAt: string } & any): Document {
    const name = r.name ?? String(r._id);
    const title = r.vintage != null ? `${name} (${r.vintage})` : name;
    return {
      id: r.id,
      title,
      content: this.buildFundContent(r),
      createdAt: r.createdAt,
    } as Document;
  }

  // Public method to generate embeddings for search queries
  async generateQueryEmbedding(text: string): Promise<number[]> {
    return this.embeddingsService.generateQueryEmbedding(text);
  }

  // Get the embeddings service instance
  getEmbeddingsService(): EmbeddingsService {
    return this.embeddingsService;
  }

  // Generate embedding for a fund row and persist it to VSS table
  async generateAndStoreFundEmbeddingById(id: number): Promise<boolean> {
    try {
      const r = this.db
        .prepare(
          `SELECT id, _id, name, aliases, manager, vintage, strategy, geography, strategyGroup, geographyGroup,
                  fundSize, targetSize, status, industries
           FROM funds WHERE id = ?`
        )
        .get(id) as any | undefined;
      if (!r) return false;

      const name = r.name ?? String(r._id);
      const title = r.vintage != null ? `${name} (${r.vintage})` : name;
      const content = this.buildFundContent(
        {
          name: r.name,
          aliases: r.aliases,
          manager: r.manager,
          vintage: r.vintage,
          strategy: r.strategy,
          geography: r.geography,
          fundSize: r.fundSize,
          targetSize: r.targetSize,
          status: r.status,
          industries: r.industries,
        },
        { includeName: false }
      );

      const embedding = await this.embeddingsService.generateDocumentEmbedding(title, content);
      if (!Array.isArray(embedding) || embedding.length === 0) return false;

      const stmt = this.db.prepare('INSERT OR REPLACE INTO funds_vss(rowid, embedding) VALUES (?, ?)');
      const blob = Buffer.from(new Float32Array(embedding).buffer);
      console.log('Inserting VSS embedding BLOB ' + blob.length);
      stmt.run(id, blob);
      return true;
    } catch (error) {
      console.warn('[WARN] Failed to generate/store embedding for fund:', (error as Error).message);
      return false;
    }
  }

  // Insert a fund: persists raw fields to funds only
  insertFund(fund: IOFundModel): number {
    try {
      const aliasesJson = JSON.stringify(fund.aliases ?? []);
      const industriesJson = JSON.stringify(fund.industries ?? []);
      this.db
        .prepare(
          `INSERT OR IGNORE INTO funds (
             _id, name, aliases, manager, vintage, strategy, geography, strategyGroup, geographyGroup, fundSize, targetSize, status, industries
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          String(fund._id),
          fund.name ?? null,
          aliasesJson,
          (fund as any).manager ?? null,
          fund.vintage ?? null,
          fund.strategy ?? null,
          fund.geography ?? null,
          fund.strategyGroup ?? null,
          fund.geographyGroup ?? null,
          fund.fundSize ?? null,
          fund.targetSize ?? null,
          fund.status ?? null,
          industriesJson
        );

      const row = this.db.prepare('SELECT id FROM funds WHERE _id = ?').get(String(fund._id)) as
        | { id: number }
        | undefined;
      const id = row?.id ?? 0;
      if (id) console.log(`[OK] Fund upserted with ID: ${id}`);
      else console.log('[WARN] Fund insert did not return an ID');
      return id;
    } catch (error) {
      console.error('[ERROR] Error inserting fund:', error);
      throw error;
    }
  }

  // Get all documents (synthesized from funds rows)
  getAllDocuments(): Document[] {
    try {
      const rows = this.db
        .prepare(
          `SELECT id, _id, name, aliases, manager, vintage, strategy, geography, strategyGroup, geographyGroup,
                  fundSize, targetSize, status, industries, createdAt AS createdAt
           FROM funds
           ORDER BY createdAt DESC`
        )
        .all() as any[];
      return rows.map((r) => this.fundRowToDocument(r));
    } catch (error) {
      console.error('[ERROR] Error getting documents:', error);
      throw error;
    }
  }

  // Delete a document
  deleteDocument(id: number): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM funds WHERE id = ?');
      const result = stmt.run(id);
      if (result.changes > 0) {
        console.log(`[OK] Fund deleted with ID: ${id}`);
        return true;
      }
      console.log(`[WARN] No fund found with ID: ${id}`);
      return false;
    } catch (error) {
      console.error('[ERROR] Error deleting fund:', error);
      throw error;
    }
  }

  // Get fund as a synthesized document by ID
  getDocumentById(id: number): Document | null {
    try {
      const r = this.db
        .prepare(
          `SELECT id, _id, name, aliases, manager, vintage, strategy, geography, strategyGroup, geographyGroup,
                  fundSize, targetSize, status, industries, createdAt AS createdAt
           FROM funds WHERE id = ?`
        )
        .get(id) as any;
      if (!r) return null;
      return this.fundRowToDocument(r);
    } catch (error) {
      console.error('[ERROR] Error getting fund by ID:', error);
      throw error;
    }
  }

  // Get embedding for a specific fund/document as a Float32Array view (no copy)
  getEmbeddingByDocumentId(documentId: number): Float32Array | null {
    try {
      const row = this.db
        .prepare('SELECT embedding FROM funds_vss WHERE rowid = ?')
        .get(documentId) as { embedding?: any } | undefined;
      if (!row || row.embedding == null) return null;
      const raw = row.embedding as any;
      const buf: Buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      if (buf.byteLength === 0) return null;
      if (buf.byteLength % 4 !== 0) return null;
      return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    } catch (error) {
      console.warn('[WARN] Failed to read embedding:', (error as Error).message);
      return null;
    }
  }

  // Update embedding for a fund/document (deprecated)
  updateEmbedding(_documentId: number, _newEmbedding: number[]): boolean {
    console.log('[INFO] updateEmbedding is deprecated; use generateAndStoreFundEmbeddingById');
    return false;
  }

  // Get database statistics
  getStats(): DatabaseStats {
    try {
      const fundCount = this.db.prepare('SELECT COUNT(*) as count FROM funds').get() as { count: number };
      let embCount: { count: number } = { count: 0 };
      try {
        embCount = this.db.prepare('SELECT COUNT(*) as count FROM funds_vss').get() as { count: number };
      } catch {}
      return { documents: fundCount.count, embeddings: embCount.count, orphaned_documents: 0 };
    } catch (error) {
      console.error('[ERROR] Error getting stats:', error);
      throw error;
    }
  }

  // Get database schema for LLM context
  getDatabaseSchema(): DatabaseSchema {
    try {
      return {
        tables: {
          documents: {
            columns: [
              'id',
              '_id',
              'name',
              'aliases',
              'manager',
              'vintage',
              'strategy',
              'geography',
              'strategyGroup',
              'geographyGroup',
              'fundSize',
              'targetSize',
              'status',
              'industries',
              'createdAt',
            ],
            description: 'Funds table storing raw Mongo fields (aliases, industries as JSON strings)',
          },
          embeddings: { columns: [], description: 'Embeddings stored in funds_vss virtual table' },
        },
        relationships: [],
        indexes: [],
      };
    } catch (error) {
      console.error('[ERROR] Error getting database schema:', error);
      throw error;
    }
  }
}
