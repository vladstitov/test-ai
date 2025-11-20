import type { IOFundModel } from './fund.types';
import { EmbeddingsService } from './embeddings.service';
export type Document = IOFundModel & {
    id: number;
    createdAt: string;
    title?: string;
    content?: string;
};
export declare class QdrantRepository {
    private collection;
    private embeddings;
    private dim;
    constructor(collection: string, embeddings: EmbeddingsService, dim?: number);
    ensureCollection(): Promise<void>;
    private buildFundContent;
    private toDocument;
    insertFund(fund: IOFundModel, i: number): Promise<void>;
    getAllDocuments(limit?: number): Promise<Document[]>;
    deleteDocument(id: number): Promise<boolean>;
    getStats(): Promise<{
        documents: number;
        embeddings: number;
        orphaned_documents: number;
    }>;
    searchSimilar(query: string, topK?: number): Promise<Array<Document & {
        distance: number;
    }>>;
}
//# sourceMappingURL=qdrant.repo.d.ts.map