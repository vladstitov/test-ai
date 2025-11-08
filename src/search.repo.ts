import Database from 'better-sqlite3';
import type { IOFundModel } from './fund.types';

export interface FundWithSimilarity extends IOFundModel {
  similarity: number;
  distance: number;
  createdAt: string;
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

export class SearchRepository {
  private db: Database.Database;

  constructor(dbInstance: Database.Database) {
    if (!dbInstance) throw new Error('Database instance is required');
    this.db = dbInstance;
  }

  private parseJsonList(jsonStr?: string): string[] {
    if (!jsonStr) return [];
    try { const v = JSON.parse(jsonStr); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
  }

  searchByText(searchTerm: string, limit: number = 10): IOFundModel[] {
    const pattern = `%${searchTerm}%`;
    const rows = this.db.prepare(`
      SELECT id, _id, name, aliases, vintage, strategy, geography, strategyGroup, geographyGroup,
             fundSize, targetSize, status, industries, createdAt AS createdAt
      FROM funds
      WHERE name LIKE ? OR strategy LIKE ? OR geography LIKE ? OR status LIKE ?
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(pattern, pattern, pattern, pattern, limit) as Array<any>;
    return rows.map(r => ({
      id: r.id,
      _id: String(r._id),
      name: r.name,
      aliases: this.parseJsonList(r.aliases),
      fundType: r.fundType,
      manager: r.manager,
      vintage: r.vintage,
      strategy: r.strategy,
      geography: r.geography,
      strategyGroup: r.strategyGroup,
      geographyGroup: r.geographyGroup,
      fundSize: r.fundSize,
      targetSize: r.targetSize,
      status: r.status,
      industries: this.parseJsonList(r.industries),
    }));
  }

  searchByTextAdvanced(searchTerms: string[], operator: 'AND' | 'OR' = 'OR', limit: number = 10): IOFundModel[] {
    if (!Array.isArray(searchTerms) || searchTerms.length === 0) return [];
    const clauses: string[] = [];
    const params: any[] = [];
    for (const term of searchTerms) {
      const p = `%${term}%`;
      clauses.push('(name LIKE ? OR strategy LIKE ? OR geography LIKE ? OR status LIKE ?)');
      params.push(p, p, p, p);
    }
    const where = clauses.join(` ${operator} `);
    params.push(limit);
    const rows = this.db.prepare(`
      SELECT id, _id, name, aliases, vintage, strategy, geography, strategyGroup, geographyGroup,
             fundSize, targetSize, status, industries, createdAt AS createdAt
      FROM funds
      WHERE ${where}
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(...params) as Array<any>;
    return rows.map(r => ({
      id: r.id,
      _id: String(r._id),
      name: r.name,
      manager: r.manager,
      aliases: this.parseJsonList(r.aliases),
      fundType: r.fundType,
      vintage: r.vintage,
      strategy: r.strategy,
      geography: r.geography,
      strategyGroup: r.strategyGroup,
      geographyGroup: r.geographyGroup,
      fundSize: r.fundSize,
      targetSize: r.targetSize,
      status: r.status,
      industries: this.parseJsonList(r.industries),
    }));
  }

  // Vector similarity is not supported for funds-only schema
  searchSimilar(queryEmbedding: number[], limit: number = 5): FundWithSimilarity[] {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return [];
    const blob = Buffer.from(new Float32Array(queryEmbedding).buffer);
    const rows = this.db.prepare(`
      SELECT f.id, f._id, f.name, f.aliases, f.vintage, f.strategy, f.geography, f.strategyGroup, f.geographyGroup,
             f.fundSize, f.targetSize, f.status, f.industries,
             f.createdAt AS createdAt,
             v.distance as distance
      FROM funds_vec v
      JOIN funds f ON f.id = v.rowid
      WHERE v.embedding MATCH ?
      ORDER BY v.distance LIMIT ?
    `).all(blob, limit, limit) as Array<any>;
    return rows.map(r => ({
      id: r.id,
      _id: String(r._id),
      name: r.name,
      aliases: this.parseJsonList(r.aliases),
      fundType: undefined,
      vintage: r.vintage,
      manager: r.manager,
      strategy: r.strategy,
      geography: r.geography,
      strategyGroup: r.strategyGroup,
      geographyGroup: r.geographyGroup,
      fundSize: r.fundSize,
      targetSize: r.targetSize,
      status: r.status,
      industries: this.parseJsonList(r.industries),
      similarity: 1 - (typeof r.distance === 'number' ? r.distance : Number(r.distance) || 0),
      distance: (typeof r.distance === 'number' ? r.distance : Number(r.distance) || 0),
      createdAt: r.createdAt,
    }));
  }

  hybridSearch(query: string, _queryEmbedding: number[], textWeight: number = 1, semanticWeight: number = 0, limit: number = 10): HybridSearchResult[] {
    const textResults = this.searchByText(query, limit * 2);
    return textResults.slice(0, limit).map(f => ({
      ...f,
      similarity: 1,
      distance: 0,
      createdAt: new Date().toISOString(),
      textScore: textWeight,
      semanticScore: 0,
      totalScore: textWeight + 0 * semanticWeight,
    }));
  }

  searchWithClustering(_queryEmbedding: number[], _limit: number = 10, _similarityThreshold: number = 0.8): Array<{ cluster: number; documents: FundWithSimilarity[] }> {
    console.log('[INFO] Clustering not supported for funds-only schema');
    return [];
  }

  searchWithFacets(queryEmbedding: number[], limit: number = 20): { results: FundWithSimilarity[]; facets: { similarityRanges: { range: string; count: number }[]; timePeriods: { period: string; count: number }[]; }; } {
    const results: FundWithSimilarity[] = this.searchSimilar(queryEmbedding, limit);
    const similarityRanges = [
      { range: '0.9-1.0', count: 0 },
      { range: '0.7-0.9', count: 0 },
      { range: '0.5-0.7', count: 0 },
      { range: '0.0-0.5', count: 0 },
    ];
    const now = new Date();
    const timePeriods = [
      { period: 'Last 24 hours', count: 0 },
      { period: 'Last week', count: 0 },
      { period: 'Last month', count: 0 },
      { period: 'Older', count: 0 },
    ];
    results.forEach(doc => {
      if (doc.similarity >= 0.9) similarityRanges[0].count++;
      else if (doc.similarity >= 0.7) similarityRanges[1].count++;
      else if (doc.similarity >= 0.5) similarityRanges[2].count++;
      else similarityRanges[3].count++;
      const days = (now.getTime() - new Date(doc.createdAt).getTime()) / (1000 * 3600 * 24);
      if (days <= 1) timePeriods[0].count++; else if (days <= 7) timePeriods[1].count++; else if (days <= 30) timePeriods[2].count++; else timePeriods[3].count++;
    });
    return { results, facets: { similarityRanges, timePeriods } };
  }
}
