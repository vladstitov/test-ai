import { QdrantClient } from '@qdrant/js-client-rest';
export declare function getQdrantClient(): QdrantClient;
export declare function ensureCollection(collection: string, dim?: number): Promise<void>;
export declare function dropAndCreateCollection(collection: string, dim?: number): Promise<void>;
export type UpsertPoint = {
    embeddingText: string;
    vector?: number[];
    payload?: Record<string, any>;
};
export declare function upsertPoints(collection: string, points: UpsertPoint[]): Promise<void>;
export declare function searchPoints(collection: string, vector: number[], limit: number, with_payload?: boolean): Promise<{
    id: string | number;
    version: number;
    score: number;
    payload?: Record<string, unknown> | {
        [key: string]: unknown;
    } | null | undefined;
    vector?: Record<string, unknown> | number[] | number[][] | {
        [key: string]: number[] | number[][] | {
            indices: number[];
            values: number[];
        } | undefined;
    } | null | undefined;
    shard_key?: string | number | Record<string, unknown> | null | undefined;
    order_value?: number | Record<string, unknown> | null | undefined;
}[]>;
export declare function scrollPoints(collection: string, params: any): Promise<{
    points: {
        id: string | number;
        payload?: Record<string, unknown> | {
            [key: string]: unknown;
        } | null | undefined;
        vector?: Record<string, unknown> | number[] | number[][] | {
            [key: string]: number[] | number[][] | {
                indices: number[];
                values: number[];
            } | undefined;
        } | null | undefined;
        shard_key?: string | number | Record<string, unknown> | null | undefined;
        order_value?: number | Record<string, unknown> | null | undefined;
    }[];
    next_page_offset?: string | number | Record<string, unknown> | null | undefined;
}>;
export declare function deletePoints(collection: string, ids: Array<number | string>): Promise<void>;
export declare function countPoints(collection: string, exact?: boolean): Promise<number>;
export declare function retrievePoint(collection: string, id: number | string, with_vector?: boolean, with_payload?: boolean): Promise<any>;
//# sourceMappingURL=qdrant-connector.d.ts.map