import { QdrantRepository } from '../qdrant.repo';
interface LoadOptions {
    offset: number;
    limit: number;
    maxBatches: number;
}
export declare function insertFundsFromMongo(dbRepo: QdrantRepository, opts: LoadOptions): Promise<{
    inserted: number;
    batches: number;
}>;
export {};
//# sourceMappingURL=load-real-data.d.ts.map