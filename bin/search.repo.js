"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchRepository = void 0;
class SearchRepository {
    constructor(dbInstance) {
        if (!dbInstance)
            throw new Error('Database instance is required');
        this.db = dbInstance;
    }
    parseJsonList(jsonStr) {
        if (!jsonStr)
            return [];
        try {
            const v = JSON.parse(jsonStr);
            return Array.isArray(v) ? v.map(String) : [];
        }
        catch {
            return [];
        }
    }
    searchByText(searchTerm, limit = 10) {
        const pattern = `%${searchTerm}%`;
        const rows = this.db.prepare(`
      SELECT id, _id, name, aliases, vintage, strategy, geography, strategyGroup, geographyGroup,
             fundSize, targetSize, status, industries, createdAt AS createdAt
      FROM funds
      WHERE name LIKE ? OR strategy LIKE ? OR geography LIKE ? OR status LIKE ?
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(pattern, pattern, pattern, pattern, limit);
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
    searchByTextAdvanced(searchTerms, operator = 'OR', limit = 10) {
        if (!Array.isArray(searchTerms) || searchTerms.length === 0)
            return [];
        const clauses = [];
        const params = [];
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
    `).all(...params);
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
    searchSimilar(queryEmbedding, limit = 5) {
        if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0)
            return [];
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
    `).all(blob, limit, limit);
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
    hybridSearch(query, _queryEmbedding, textWeight = 1, semanticWeight = 0, limit = 10) {
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
    searchWithClustering(_queryEmbedding, _limit = 10, _similarityThreshold = 0.8) {
        console.log('[INFO] Clustering not supported for funds-only schema');
        return [];
    }
    searchWithFacets(queryEmbedding, limit = 20) {
        const results = this.searchSimilar(queryEmbedding, limit);
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
            if (doc.similarity >= 0.9)
                similarityRanges[0].count++;
            else if (doc.similarity >= 0.7)
                similarityRanges[1].count++;
            else if (doc.similarity >= 0.5)
                similarityRanges[2].count++;
            else
                similarityRanges[3].count++;
            const days = (now.getTime() - new Date(doc.createdAt).getTime()) / (1000 * 3600 * 24);
            if (days <= 1)
                timePeriods[0].count++;
            else if (days <= 7)
                timePeriods[1].count++;
            else if (days <= 30)
                timePeriods[2].count++;
            else
                timePeriods[3].count++;
        });
        return { results, facets: { similarityRanges, timePeriods } };
    }
}
exports.SearchRepository = SearchRepository;
//# sourceMappingURL=search.repo.js.map