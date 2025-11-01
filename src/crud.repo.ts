import Database from 'better-sqlite3';
import { EmbeddingsService } from './embeddings.service';

// ========================================
// TYPES AND INTERFACES
// ========================================

export interface Document {
  id: number;
  title: string;
  content: string;
  category?: string;
  tags?: string;
  created_at: string;
}

export interface DocumentWithEmbedding extends Document {
  embedding?: number[];
}

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

  // Public method to generate embeddings for search queries
  async generateQueryEmbedding(text: string): Promise<number[]> {
    return this.embeddingsService.generateQueryEmbedding(text);
  }

  // Get the embeddings service instance
  getEmbeddingsService(): EmbeddingsService {
    return this.embeddingsService;
  }

  // Insert a document with its vector embedding (generated using EmbeddingsService)
  async insertDocument(title: string, content: string, category?: string, tags?: string[]): Promise<number> {
    try {
      // Generate embedding using EmbeddingsService - include all metadata for richer embeddings
      const embedding = await this.embeddingsService.generateDocumentEmbedding(title, content, category, tags);

      const tagsString = tags ? tags.join(', ') : null;

      if (this.vssAvailable) {
        // Use VSS extension: store embedding as BLOB in documents table
        const insertDoc = this.db.prepare(`
          INSERT INTO documents (title, content, category, tags, embedding) 
          VALUES (?, ?, ?, ?, ?)
        `);

        const embeddingBuffer = new Float32Array(embedding);
        const docResult = insertDoc.run(title, content, category || null, tagsString, Buffer.from(embeddingBuffer.buffer));
        const docId = docResult.lastInsertRowid as number;

        console.log(`[INFO] VSS: Vector stored as BLOB (${embedding.length} dimensions)`);
        console.log(`[OK] Document inserted with ID: ${docId} using VSS storage`);
        return docId;
      } else {
        // Fallback to JSON storage in documents table
        const insertDoc = this.db.prepare(`
          INSERT INTO documents (title, content, category, tags, embedding) 
          VALUES (?, ?, ?, ?, ?)
        `);

        const embeddingString = JSON.stringify(embedding);
        const docResult = insertDoc.run(title, content, category || null, tagsString, embeddingString);
        const docId = docResult.lastInsertRowid as number;

        console.log(`[INFO] JSON: Vector stored as JSON string (${embedding.length} dimensions)`);
        console.log(`[OK] Document inserted with ID: ${docId} using JSON storage`);
        return docId;
      }
    } catch (error) {
      console.error('[ERROR] Error inserting document:', error);
      throw error;
    }
  }

  // Get all documents
  getAllDocuments(): Document[] {
    try {
      const stmt = this.db.prepare('SELECT id, title, content, category, tags, created_at FROM documents ORDER BY created_at DESC');
      return stmt.all() as Document[];
    } catch (error) {
      console.error('[ERROR] Error getting documents:', error);
      throw error;
    }
  }

  // Delete a document
  deleteDocument(id: number): boolean {
    try {
      this.db.exec('PRAGMA foreign_keys = ON');

      const deleteDoc = this.db.prepare('DELETE FROM documents WHERE id = ?');
      const result = deleteDoc.run(id);

      if (result.changes > 0) {
        console.log(`[OK] Document with ID ${id} deleted successfully`);
      } else {
        console.log(`[WARN] No document found with ID ${id}`);
      }

      return result.changes > 0;
    } catch (error) {
      console.error('[ERROR] Error deleting document:', error);
      throw error;
    }
  }

  // Update document content
  updateDocument(id: number, title?: string, content?: string): boolean {
    try {
      const updates: string[] = [];
      const params: any[] = [];

      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
      }

      if (content !== undefined) {
        updates.push('content = ?');
        params.push(content);
      }

      if (updates.length === 0) {
        console.log('[WARN] No updates provided');
        return false;
      }

      updates.push('created_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE documents SET ${updates.join(', ')} WHERE id = ?`;
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);

      if (result.changes > 0) {
        console.log(`[OK] Document with ID ${id} updated successfully`);
      } else {
        console.log(`[WARN] No document found with ID ${id}`);
      }

      return result.changes > 0;
    } catch (error) {
      console.error('[ERROR] Error updating document:', error);
      throw error;
    }
  }

  // Get document by ID with embedding
  getDocumentById(id: number): DocumentWithEmbedding | null {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          id, 
          title, 
          content, 
          category,
          tags,
          embedding,
          created_at
        FROM documents 
        WHERE id = ?
      `);

      const doc = stmt.get(id) as (Document & { embedding?: Buffer | string }) | undefined;

      if (!doc) return null;

      const result: DocumentWithEmbedding = {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        category: doc.category,
        tags: doc.tags,
        created_at: doc.created_at
      };

      if (doc.embedding) {
        if (Buffer.isBuffer(doc.embedding)) {
          const float32Array = new Float32Array(doc.embedding.buffer, doc.embedding.byteOffset, doc.embedding.byteLength / 4);
          result.embedding = Array.from(float32Array);
        } else if (typeof doc.embedding === 'string') {
          result.embedding = JSON.parse(doc.embedding);
        }
      }

      return result;
    } catch (error) {
      console.error('[ERROR] Error getting document by ID:', error);
      throw error;
    }
  }

  // Get embedding for a specific document
  getEmbeddingByDocumentId(documentId: number): number[] | null {
    try {
      const stmt = this.db.prepare('SELECT embedding FROM documents WHERE id = ?');
      const result = stmt.get(documentId) as { embedding: Buffer | string } | undefined;

      if (result && result.embedding) {
        if (Buffer.isBuffer(result.embedding)) {
          const float32Array = new Float32Array(result.embedding.buffer, result.embedding.byteOffset, result.embedding.byteLength / 4);
          return Array.from(float32Array);
        } else if (typeof result.embedding === 'string') {
          return JSON.parse(result.embedding);
        }
      }

      return null;
    } catch (error) {
      console.error('[ERROR] Error getting embedding:', error);
      throw error;
    }
  }

  // Update embedding for a document
  updateEmbedding(documentId: number, newEmbedding: number[]): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE documents 
        SET embedding = ? 
        WHERE id = ?
      `);

      let embeddingData: Buffer | string;
      if (this.vssAvailable) {
        const embeddingBuffer = new Float32Array(newEmbedding);
        embeddingData = Buffer.from(embeddingBuffer.buffer);
      } else {
        embeddingData = JSON.stringify(newEmbedding);
      }

      const result = stmt.run(embeddingData, documentId);

      if (result.changes > 0) {
        console.log(`[OK] Embedding updated for document ID: ${documentId}`);
      } else {
        console.log(`[WARN] No document found with ID: ${documentId}`);
      }

      return result.changes > 0;
    } catch (error) {
      console.error('[ERROR] Error updating embedding:', error);
      throw error;
    }
  }

  // Get database statistics
  getStats(): DatabaseStats {
    try {
      const docCount = this.db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
      const embeddingCount = this.db.prepare('SELECT COUNT(*) as count FROM documents WHERE embedding IS NOT NULL').get() as { count: number };

      return {
        documents: docCount.count,
        embeddings: embeddingCount.count,
        orphaned_documents: docCount.count - embeddingCount.count
      };
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
            columns: ['id', 'title', 'content', 'category', 'tags', 'embedding', 'created_at'],
            description: 'Main documents table containing titles, content, metadata, and embeddings'
          },
          embeddings: {
            columns: [],
            description: 'Deprecated - embeddings now stored directly in documents table'
          }
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
      const query = `
        SELECT d.id, d.title, d.content, d.created_at
        FROM documents d
        WHERE d.created_at BETWEEN ? AND ?
        ORDER BY d.created_at DESC
        LIMIT ?
      `;

      return this.executeQuery(query, [startDate, endDate, limit]);
    } catch (error) {
      console.error('[ERROR] Error getting documents by date range:', error);
      throw error;
    }
  }

  // List distinct categories
  getAllCategories(): string[] {
    try {
      const rows = this.db.prepare("SELECT DISTINCT category as c FROM documents WHERE category IS NOT NULL ORDER BY category ASC").all() as Array<{ c: string }>;
      return rows.map(r => r.c);
    } catch (error) {
      console.error('[ERROR] Error getting categories:', error);
      throw error;
    }
  }

  // List distinct tags (split comma-separated, trim, dedupe)
  getAllTags(): string[] {
    try {
      const rows = this.db.prepare("SELECT tags FROM documents WHERE tags IS NOT NULL").all() as Array<{ tags: string }>;
      const tagSet = new Set<string>();
      rows.forEach(r => {
        r.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t));
      });
      return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
    } catch (error) {
      console.error('[ERROR] Error getting tags:', error);
      throw error;
    }
  }

  // Get documents by category
  getDocumentsByCategory(category: string): Document[] {
    try {
      const stmt = this.db.prepare(
        'SELECT id, title, content, category, tags, created_at FROM documents WHERE category = ? ORDER BY created_at DESC'
      );
      return stmt.all(category) as Document[];
    } catch (error) {
      console.error('[ERROR] Error getting documents by category:', error);
      throw error;
    }
  }

  // Get documents with existing embeddings, most recent first (by document timestamp)
  getRecentlyEmbedded(limit: number = 10): Array<Document & { embedding_created: string }> {
    try {
      const query = `
        SELECT d.id, d.title, d.content, d.category, d.tags, d.created_at
        FROM documents d
        WHERE d.embedding IS NOT NULL
        ORDER BY d.created_at DESC
        LIMIT ?
      `;

      const rows = this.executeQuery(query, [limit]) as Array<Document>;
      return rows.map(r => ({ ...r, embedding_created: r.created_at }));
    } catch (error) {
      console.error('[ERROR] Error getting recently embedded documents:', error);
      throw error;
    }
  }
}
