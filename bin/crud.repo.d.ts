import Database from 'better-sqlite3';
import { EmbeddingsService } from './embeddings.service';
import type { IOFundModel } from './fund.types';
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
export declare class CrudRepository {
    private db;
    private embeddingsService;
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
    getDocumentById(id: number): Document | null;
    getEmbeddingByDocumentId(documentId: number): Float32Array | null;
    updateEmbedding(_documentId: number, _newEmbedding: number[]): boolean;
    getStats(): DatabaseStats;
    getDatabaseSchema(): DatabaseSchema;
    getStrategies(): string[];
    getGeographies(): string[];
}
//# sourceMappingURL=crud.repo.d.ts.map