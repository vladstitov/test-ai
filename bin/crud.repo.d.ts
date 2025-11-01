import Database from 'better-sqlite3';
import { EmbeddingsService } from './embeddings.service';
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
export declare class CrudRepository {
    private db;
    private embeddingsService;
    private vssAvailable;
    constructor(dbInstance: Database.Database, embeddingsService: EmbeddingsService);
    generateQueryEmbedding(text: string): Promise<number[]>;
    getEmbeddingsService(): EmbeddingsService;
    insertDocument(title: string, content: string, category?: string, tags?: string[]): Promise<number>;
    getAllDocuments(): Document[];
    deleteDocument(id: number): boolean;
    updateDocument(id: number, title?: string, content?: string): boolean;
    getDocumentById(id: number): DocumentWithEmbedding | null;
    getEmbeddingByDocumentId(documentId: number): number[] | null;
    updateEmbedding(documentId: number, newEmbedding: number[]): boolean;
    getStats(): DatabaseStats;
    getDatabaseSchema(): DatabaseSchema;
    executeQuery(sql: string, params?: any[]): any;
    getDocumentsByDateRange(startDate: string, endDate: string, limit?: number): Document[];
    getAllCategories(): string[];
    getAllTags(): string[];
    getDocumentsByCategory(category: string): Document[];
    getRecentlyEmbedded(limit?: number): Array<Document & {
        embedding_created: string;
    }>;
}
//# sourceMappingURL=crud.repo.d.ts.map