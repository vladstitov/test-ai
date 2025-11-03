import Database from 'better-sqlite3';
import { EmbeddingsService } from './embeddings.service';
import type { IOFundModel } from './fund.types';

// ========================================
// TYPES AND INTERFACES
// ========================================

export type Document = IOFundModel & { id: number; created_at: string; title?: string; content?: string };

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
  private vssAvailable: boolean = false;

  constructor(
    dbInstance: Database.Database,
    embeddingsService: EmbeddingsService
  ) {
    if (!dbInstance) {
      throw new Error('Database instance is required');
    }
    if (!embeddingsService) {
      throw new Error('EmbeddingsService instance is required');
    }
    this.db = dbInstance;
    this.embeddingsService = embeddingsService;

    // Check if VSS extension is available
    try {
      this.db.exec('SELECT vec_version()');
      this.vssAvailable = true;
      console.log('[INFO] sqlite-vec extension detected - using native vector operations');
    } catch (error) {
      this.vssAvailable = false;
      console.log('[INFO] Using JSON embedding storage (sqlite-vec extension not available)');
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
  private buildFundContent(r: {
    name?: string; aliases?: string; fundType?: string; status?: string; vintage?: number;
    strategy?: string; strategyGroup?: string; geography?: string; geographyGroup?: string;
    industries?: string; fundSize?: number; targetSize?: number;
  }): string {
    const aliases = this.parseJsonList(r.aliases);
    const industries = this.parseJsonList(r.industries);
    const parts: string[] = [];
    parts.push(`Name: ${r.name ?? 'Unknown'}`);
    if (aliases.length) parts.push(`Aliases: ${aliases.join(', ')}`);
    if (r.fundType) parts.push(`Type: ${r.fundType}`);
    if (r.status) parts.push(`Status: ${r.status}`);
    if (r.vintage != null) parts.push(`Vintage: ${r.vintage}`);
    if (r.strategy) parts.push(`Strategy: ${r.strategy}`);
    if (r.strategyGroup) parts.push(`Strategy Group: ${r.strategyGroup}`);
    if (r.geography) parts.push(`Geography: ${r.geography}`);
    if (r.geographyGroup) parts.push(`Geography Group: ${r.geographyGroup}`);
    if (industries.length) parts.push(`Industries: ${industries.join(', ')}`);
    if (r.fundSize != null) parts.push(`Fund Size: ${r.fundSize}`);
    if (r.targetSize != null) parts.push(`Target Size: ${r.targetSize}`);
    return parts.join('\n');
  }

  // Helper: map a funds row to a Document-like object
  private fundRowToDocument(r: { id: number; name: string; created_at: string } & any): Document {
    return {
      id: r.id,
      title: r.name,
      content: this.buildFundContent(r),
      created_at: r.created_at,
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

  // Generate embedding for a fund row and persist it to funds.embedding
  async generateAndStoreFundEmbeddingById(id: number): Promise<boolean> {
    try {
      const r = this.db.prepare(`
        SELECT id, _id, name, aliases, fundType, vintage, strategy, geography, strategyGroup, geographyGroup,
               fundSize, targetSize, status, industries
        FROM funds WHERE id = ?
      `).get(id) as any | undefined;
      if (!r) return false;

      const title = r.name ?? String(r._id);
      const content = this.buildFundContent({
        name: r.name,
        aliases: r.aliases,
        fundType: r.fundType,
        vintage: r.vintage,
        strategy: r.strategy,
        geography: r.geography,
        strategyGroup: r.strategyGroup,
        geographyGroup: r.geographyGroup,
        fundSize: r.fundSize,
        targetSize: r.targetSize,
        status: r.status,
        industries: r.industries,
      });

      const embedding = await this.embeddingsService.generateDocumentEmbedding(title, content);
      if (!Array.isArray(embedding) || embedding.length === 0) return false;

      const stmt = this.db.prepare('UPDATE funds SET embedding = ? WHERE id = ?');
      if (this.vssAvailable) {
        const blob = Buffer.from(new Float32Array(embedding).buffer);
        stmt.run(blob, id);
      } else {
        stmt.run(JSON.stringify(embedding), id);
      }
      return true;
    } catch (error) {
      console.warn('[WARN] Failed to generate/store embedding for fund:', (error as Error).message);
      return false;
    }
  }

  // Insert a fund: persists raw fields to funds only
  insertFund(fund: IOFundModel): number {
    try {
      // Persist raw fields into funds table, then map to documents
      try {
        const aliasesJson = JSON.stringify(fund.aliases ?? []);
        const industriesJson = JSON.stringify(fund.industries ?? []);
        this.executeQuery(
          `INSERT OR IGNORE INTO funds (
            _id, name, aliases, fundType, vintage, strategy, geography, strategyGroup, geographyGroup, fundSize, targetSize, status, industries
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            String(fund._id),
            fund.name ?? null,
            aliasesJson,
            fund.fundType ?? null,
            fund.vintage ?? null,
            fund.strategy ?? null,
            fund.geography ?? null,
            fund.strategyGroup ?? null,
            fund.geographyGroup ?? null,
            fund.fundSize ?? null,
            fund.targetSize ?? null,
            fund.status ?? null,
            industriesJson,
          ]
        );
      } catch (e) {
        console.warn('[WARN] insertFund: failed inserting into funds table:', (e as Error).message);
      }

      // Return the primary key id of the funds row
      const row = this.db.prepare('SELECT id FROM funds WHERE _id = ?').get(String(fund._id)) as { id: number } | undefined;
      const id = row?.id ?? 0;
      if (id) {
        console.log(`[OK] Fund upserted with ID: ${id}`);
      } else {
        console.log('[WARN] Fund insert did not return an ID');
      }
      return id;
    } catch (error) {
      console.error('[ERROR] Error inserting fund:', error);
      throw error;
    }
  }

  // Get all documents (synthesized from funds rows)
  getAllDocuments(): Document[] {
    try {
      // Adapted to new structure: synthesize documents from funds rows
      const rows = this.db.prepare(`
        SELECT id, _id, name, aliases, fundType, vintage, strategy, geography, strategyGroup, geographyGroup,
               fundSize, targetSize, status, industries, created_at
        FROM funds
        ORDER BY created_at DESC
      `).all() as Array<IOFundModel>;

      return rows.map(r => this.fundRowToDocument(r));
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

  // Update fund fields (partial)
  updateDocument(id: number, changes: Partial<IOFundModel>): boolean {
    try {
      const updates: string[] = [];
      const params: any[] = [];

      const map: Array<[keyof IOFundModel, string, (v: any) => any]> = [
        ['name', 'name = ?', (v) => v],
        ['fundType', 'fundType = ?', (v) => v],
        ['vintage', 'vintage = ?', (v) => v],
        ['strategy', 'strategy = ?', (v) => v],
        ['geography', 'geography = ?', (v) => v],
        ['strategyGroup', 'strategyGroup = ?', (v) => v],
        ['geographyGroup', 'geographyGroup = ?', (v) => v],
        ['fundSize', 'fundSize = ?', (v) => v],
        ['targetSize', 'targetSize = ?', (v) => v],
        ['status', 'status = ?', (v) => v],
        ['aliases', 'aliases = ?', (v) => JSON.stringify(Array.isArray(v) ? v : (v == null ? [] : [String(v)]))],
        ['industries', 'industries = ?', (v) => JSON.stringify(Array.isArray(v) ? v : (v == null ? [] : [String(v)]))],
      ];

      for (const [key, fragment, transform] of map) {
        if (key in changes) {
          updates.push(fragment);
          // @ts-ignore
          params.push(transform((changes as any)[key]));
        }
      }

      if (updates.length === 0) {
        console.log('[WARN] No fields to update for fund');
        return false;
      }

      params.push(id);
      const sql = `UPDATE funds SET ${updates.join(', ')} WHERE id = ?`;
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);

      if (result.changes > 0) {
        console.log(`[OK] Fund with ID ${id} updated successfully`);
      } else {
        console.log(`[WARN] No fund found with ID ${id}`);
      }

      return result.changes > 0;
    } catch (error) {
      console.error('[ERROR] Error updating fund:', error);
      throw error;
    }
  }

  // Get fund as a synthesized document by ID
  getDocumentById(id: number): Document | null {
    try {
      const r = this.db.prepare(`
        SELECT id, _id, name, aliases, fundType, vintage, strategy, geography, strategyGroup, geographyGroup,
               fundSize, targetSize, status, industries, created_at
        FROM funds WHERE id = ?
      `).get(id) as any;
      if (!r) return null;

      const base = this.fundRowToDocument(r);
      return base;
    } catch (error) {
      console.error('[ERROR] Error getting fund by ID:', error);
      throw error;
    }
  }

  // Get embedding for a specific document
  getEmbeddingByDocumentId(documentId: number): number[] | null {
    // Not used in funds-only schema
    return null;
  }

  // Update embedding for a document
  updateEmbedding(documentId: number, newEmbedding: number[]): boolean {
    console.log('[INFO] updateEmbedding is not supported with funds-only schema');
    return false;
  }

  // Get database statistics
  getStats(): DatabaseStats {
    try {
      const fundCount = this.db.prepare('SELECT COUNT(*) as count FROM funds').get() as { count: number };
      const embCount = this.db.prepare('SELECT COUNT(*) as count FROM funds WHERE embedding IS NOT NULL').get() as { count: number };
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
            columns: ['id', '_id', 'name', 'aliases', 'fundType', 'vintage', 'strategy', 'geography', 'strategyGroup', 'geographyGroup', 'fundSize', 'targetSize', 'status', 'industries', 'created_at'],
            description: 'Funds table storing raw Mongo fields (aliases, industries as JSON strings)'
          },
          embeddings: { columns: [], description: 'Not used in funds-only schema' }
        },
        relationships: [],
        indexes: []
      };
    } catch (error) {
      console.error('[ERROR] Error getting database schema:', error);
      throw error;
    }
  }

  // Execute raw SQL query (for LLM-generated queries)
  executeQuery(sql: string, params: any[] = []): any {
    try {
      console.log(`[INFO] Executing query: ${sql}`);
      if (params.length > 0) {
        console.log(`[INFO] Parameters: ${JSON.stringify(params)}`);
      }

      const trimmedSql = sql.trim().toLowerCase();
      if (trimmedSql.startsWith('select')) {
        const stmt = this.db.prepare(sql);
        const results = stmt.all(...params);
        console.log(`[OK] Query returned ${results.length} rows`);
        return results;
      } else if (trimmedSql.startsWith('insert') || trimmedSql.startsWith('update') || trimmedSql.startsWith('delete')) {
        const stmt = this.db.prepare(sql);
        const result = stmt.run(...params);
        console.log(`[OK] Query affected ${result.changes} rows`);
        return result;
      } else {
        throw new Error('Only SELECT, INSERT, UPDATE, and DELETE queries are allowed');
      }
    } catch (error) {
      console.error('[ERROR] Error executing query:', error);
      throw error;
    }
  }

  // Get documents created within a date range
  getDocumentsByDateRange(startDate: string, endDate: string, limit: number = 50): Document[] {
    try {
      const rows = this.db.prepare(`
        SELECT id, _id, name, aliases, fundType, vintage, strategy, geography, strategyGroup, geographyGroup,
               fundSize, targetSize, status, industries, created_at
        FROM funds
        WHERE created_at BETWEEN ? AND ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(startDate, endDate, limit) as any[];

      return rows.map(r => this.fundRowToDocument(r));
    } catch (error) {
      console.error('[ERROR] Error getting funds by date range:', error);
      throw error;
    }
  }

  // List distinct strategies from funds
  getStrategies(): string[] {
    try {
      const rows = this.db
        .prepare("SELECT DISTINCT strategy as s FROM funds WHERE strategy IS NOT NULL AND TRIM(strategy) <> '' ORDER BY strategy ASC")
        .all() as Array<{ s: string }>;
      return rows.map(r => r.s);
    } catch (error) {
      console.error('[ERROR] Error getting strategies:', error);
      throw error;
    }
  }

  // List distinct geographies from funds
  getGeographies(): string[] {
    try {
      const rows = this.db
        .prepare("SELECT DISTINCT geography as g FROM funds WHERE geography IS NOT NULL AND TRIM(geography) <> '' ORDER BY geography ASC")
        .all() as Array<{ g: string }>;
      return rows.map(r => r.g);
    } catch (error) {
      console.error('[ERROR] Error getting geographies:', error);
      throw error;
    }
  }

  

  // Get documents with existing embeddings, most recent first (by document timestamp)
  getRecentlyEmbedded(limit: number = 10): Array<Document & { embedding_created: string }> {
    try {
      const rows = this.db.prepare(`
        SELECT id, name as title, created_at, aliases, industries, fundType, strategy, geography, strategyGroup, geographyGroup, fundSize, targetSize, status, vintage
        FROM funds
        ORDER BY created_at DESC
        LIMIT ?
      `).all(limit) as any[];
      return rows.map(r => {
        const doc = this.fundRowToDocument({ ...r, name: r.title });
        return { ...doc, embedding_created: doc.created_at } as any;
      });
    } catch (error) {
      console.error('[ERROR] Error getting recent funds:', error);
      throw error;
    }
  }
}
