import { CrudRepository } from './crud.repo';
interface LoadOptions {
    offset?: number;
    limit?: number;
    pageSize?: number;
    maxBatches?: number;
    dryRun?: boolean;
}
export declare function insertFundsFromMongo(dbRepo: CrudRepository, opts?: LoadOptions): Promise<{
    inserted: number;
    fetched: number;
    batches: number;
}>;
export {};
//# sourceMappingURL=load-real-data.d.ts.map