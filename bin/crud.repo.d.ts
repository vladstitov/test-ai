import Database from 'better-sqlite3';
import { EmbeddingsService } from './embeddings.service';
import type { IOFundModel } from './fund.types';
export type Document = IOFundModel & {
    id: number;
    created_at: string;
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
export declare class CrudRepository {
    private db;
    private embeddingsService;
    private vssAvailable;
    constructor(dbInstance: Database.Database, embeddingsService: EmbeddingsService);
    private parseJsonList;
    private buildFundContent;
    private fundRowToDocument;
    generateQueryEmbedding(text: string): Promise<number[]>;
    getEmbeddingsService(): EmbeddingsService;
    generateAndStoreFundEmbeddingById(id: number): Promise<boolean>;
    insertFund(fund: IOFundModel): number;
    getAllDocuments(): Document[];
    deleteDocument(id: number): boolean;
    updateDocument(id: number, changes: Partial<IOFundModel>): boolean;
    getDocumentById(id: number): Document | null;
    getEmbeddingByDocumentId(documentId: number): number[] | null;
    updateEmbedding(documentId: number, newEmbedding: number[]): boolean;
    getStats(): DatabaseStats;
    getDatabaseSchema(): DatabaseSchema;
    executeQuery(sql: string, params?: any[]): any;
    getDocumentsByDateRange(startDate: string, endDate: string, limit?: number): Document[];
    getStrategies(): string[];
    getGeographies(): string[];
    getRecentlyEmbedded(limit?: number): Array<Document & {
        embedding_created: string;
    }>;
}
//# sourceMappingURL=crud.repo.d.ts.map