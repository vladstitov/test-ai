import Database from 'better-sqlite3';
import type { IOFundModel } from './fund.types';
export interface FundWithSimilarity extends IOFundModel {
    similarity: number;
    distance: number;
    created_at: string;
}
export interface SearchFilters {
    startDate?: string;
    endDate?: string;
    minSimilarity?: number;
    maxResults?: number;
}
export interface HybridSearchResult extends FundWithSimilarity {
    textScore: number;
    semanticScore: number;
    totalScore: number;
}
export declare class SearchRepository {
    private db;
    constructor(dbInstance: Database.Database);
    private parseJsonList;
    searchByText(searchTerm: string, limit?: number): IOFundModel[];
    searchByTextAdvanced(searchTerms: string[], operator?: 'AND' | 'OR', limit?: number): IOFundModel[];
    searchSimilar(_queryEmbedding: number[], _limit?: number): FundWithSimilarity[];
    hybridSearch(query: string, _queryEmbedding: number[], textWeight?: number, semanticWeight?: number, limit?: number): HybridSearchResult[];
    searchWithClustering(_queryEmbedding: number[], _limit?: number, _similarityThreshold?: number): Array<{
        cluster: number;
        documents: FundWithSimilarity[];
    }>;
    searchWithFacets(queryEmbedding: number[], limit?: number): {
        results: FundWithSimilarity[];
        facets: {
            similarityRanges: {
                range: string;
                count: number;
            }[];
            timePeriods: {
                period: string;
                count: number;
            }[];
        };
    };
}
//# sourceMappingURL=search.repo.d.ts.map