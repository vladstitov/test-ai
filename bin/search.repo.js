"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchRepository = void 0;
// ========================================
// SEARCH REPOSITORY CLASS
// ========================================
class SearchRepository {
    constructor(dbInstance) {
        this.vssAvailable = false;
        if (!dbInstance) {
            throw new Error('Database instance is required');
        }
        this.db = dbInstance;
        // Check if VSS extension is available
        try {
            this.db.exec('SELECT vec_version()');
            this.vssAvailable = true;
            console.log('[INFO] SearchRepository: sqlite-vec extension detected');
        }
        catch (error) {
            this.vssAvailable = false;
            console.log('[INFO] SearchRepository: Using JavaScript similarity calculations');
        }
    }
    // Calculate cosine similarity between two vectors
    cosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have the same length');
        }
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }
    // Calculate Euclidean distance between two vectors
    euclideanDistance(vecA, vecB) {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have the same length');
        }
        let sum = 0;
        for (let i = 0; i < vecA.length; i++) {
            sum += Math.pow(vecA[i] - vecB[i], 2);
        }
        return Math.sqrt(sum);
    }
    // Search for similar documents using vector similarity
    searchSimilar(queryEmbedding, limit = 5, useCosineSimilarity = true, filters) {
        try {
            if (this.vssAvailable) {
                // Use sqlite-vec extension for native vector search on documents table
                console.log('[INFO] Using sqlite-vec native search on documents table');
                // Convert query embedding to buffer for VSS
                const queryBuffer = new Float32Array(queryEmbedding);
                const queryBlob = Buffer.from(queryBuffer.buffer);
                const query = `
          SELECT 
            id, 
            title, 
            content, 
            category,
            tags,
            created_at,
            vec_distance_cosine(embedding, ?) as distance
          FROM documents
          WHERE embedding IS NOT NULL
          ORDER BY distance ASC
          LIMIT ?
        `;
                const stmt = this.db.prepare(query);
                const results = stmt.all(queryBlob, limit);
                return results.map(row => ({
                    id: row.id,
                    title: row.title,
                    content: row.content,
                    category: row.category,
                    tags: row.tags,
                    created_at: row.created_at,
                    similarity: 1 - row.distance, // Convert distance to similarity
                    distance: row.distance
                }));
            }
            else {
                // Fallback to JavaScript-based similarity calculation
                console.log('[INFO] Using JavaScript similarity calculation');
                return this.searchSimilarJS(queryEmbedding, limit, useCosineSimilarity, filters);
            }
        }
        catch (error) {
            console.error('[ERROR] Error in vector search:', error);
            throw error;
        }
    }
    // JavaScript-based similarity search (fallback)
    searchSimilarJS(queryEmbedding, limit = 5, useCosineSimilarity = true, filters) {
        try {
            // Build base query with optional filters
            let query = `
        SELECT 
          d.id, 
          d.title, 
          d.content,
          d.category,
          d.tags,
          d.created_at, 
          d.embedding 
        FROM documents d 
        WHERE d.embedding IS NOT NULL
      `;
            const queryParams = [];
            const whereConditions = ['d.embedding IS NOT NULL'];
            // Add date filters if provided
            if (filters?.startDate && filters?.endDate) {
                whereConditions.push('d.created_at BETWEEN ? AND ?');
                queryParams.push(filters.startDate, filters.endDate);
            }
            if (whereConditions.length > 1) {
                query = query.replace('WHERE d.embedding IS NOT NULL', 'WHERE ' + whereConditions.join(' AND '));
            }
            const stmt = this.db.prepare(query);
            const allDocs = stmt.all(...queryParams);
            const similarities = allDocs.map(doc => {
                let docEmbedding;
                // Handle both BLOB and JSON embeddings
                if (Buffer.isBuffer(doc.embedding)) {
                    // Convert BLOB to number array
                    const float32Array = new Float32Array(doc.embedding.buffer, doc.embedding.byteOffset, doc.embedding.byteLength / 4);
                    docEmbedding = Array.from(float32Array);
                }
                else {
                    // Parse JSON string
                    docEmbedding = JSON.parse(doc.embedding);
                }
                let similarity;
                if (useCosineSimilarity) {
                    similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
                    return {
                        id: doc.id,
                        title: doc.title,
                        content: doc.content,
                        category: doc.category,
                        tags: doc.tags,
                        created_at: doc.created_at,
                        similarity: similarity,
                        distance: 1 - similarity
                    };
                }
                else {
                    const distance = this.euclideanDistance(queryEmbedding, docEmbedding);
                    return {
                        id: doc.id,
                        title: doc.title,
                        content: doc.content,
                        category: doc.category,
                        tags: doc.tags,
                        created_at: doc.created_at,
                        similarity: 1 / (1 + distance),
                        distance: distance
                    };
                }
            });
            // Filter by minimum similarity if provided
            let filteredSimilarities = similarities;
            if (filters?.minSimilarity) {
                filteredSimilarities = similarities.filter(doc => doc.similarity >= filters.minSimilarity);
            }
            // Sort by similarity (descending) and take top results
            filteredSimilarities.sort((a, b) => b.similarity - a.similarity);
            const maxResults = filters?.maxResults || limit;
            return filteredSimilarities.slice(0, maxResults);
        }
        catch (error) {
            console.error('[ERROR] Error searching similar documents:', error);
            throw error;
        }
    }
    // Search documents by text content
    searchByText(searchTerm, limit = 10) {
        try {
            const query = `
        SELECT d.id, d.title, d.content, d.category, d.tags, d.created_at
        FROM documents d
        WHERE d.title LIKE ? OR d.content LIKE ? OR d.category LIKE ? OR d.tags LIKE ?
        ORDER BY d.created_at DESC
        LIMIT ?
      `;
            const searchPattern = `%${searchTerm}%`;
            const stmt = this.db.prepare(query);
            return stmt.all(searchPattern, searchPattern, searchPattern, searchPattern, limit);
        }
        catch (error) {
            console.error('[ERROR] Error searching by text:', error);
            throw error;
        }
    }
    // Advanced text search with multiple terms
    searchByTextAdvanced(searchTerms, operator = 'OR', limit = 10) {
        try {
            const conditions = [];
            const params = [];
            searchTerms.forEach(term => {
                conditions.push('(d.title LIKE ? OR d.content LIKE ? OR d.category LIKE ? OR d.tags LIKE ?)');
                const pattern = `%${term}%`;
                params.push(pattern, pattern, pattern, pattern);
            });
            const whereClause = conditions.join(` ${operator} `);
            const query = `
        SELECT d.id, d.title, d.content, d.category, d.tags, d.created_at
        FROM documents d
        WHERE ${whereClause}
        ORDER BY d.created_at DESC
        LIMIT ?
      `;
            params.push(limit.toString());
            const stmt = this.db.prepare(query);
            return stmt.all(...params);
        }
        catch (error) {
            console.error('[ERROR] Error in advanced text search:', error);
            throw error;
        }
    }
    // Hybrid search: combine text search and semantic search
    hybridSearch(query, queryEmbedding, textWeight = 0.3, semanticWeight = 0.7, limit = 10) {
        try {
            console.log(`[INFO] Hybrid Search: "${query}"`);
            console.log(`[INFO] Weights -> Text: ${textWeight}, Semantic: ${semanticWeight}`);
            // Text search
            const textResults = this.searchByText(query, limit * 2); // Get more for better ranking
            console.log(`[INFO] Text search found ${textResults.length} results`);
            // Semantic search
            const semanticResults = this.searchSimilar(queryEmbedding, limit * 2);
            console.log(`[INFO] Semantic search found ${semanticResults.length} results`);
            // Combine results
            const combinedResults = new Map();
            // Add text results
            textResults.forEach(doc => {
                combinedResults.set(doc.id, {
                    ...doc,
                    similarity: 0,
                    distance: 0,
                    textScore: textWeight,
                    semanticScore: 0,
                    totalScore: textWeight
                });
            });
            // Add semantic results
            semanticResults.forEach(doc => {
                const existing = combinedResults.get(doc.id);
                if (existing) {
                    existing.similarity = doc.similarity;
                    existing.distance = doc.distance;
                    existing.semanticScore = doc.similarity * semanticWeight;
                    existing.totalScore = existing.textScore + existing.semanticScore;
                }
                else {
                    combinedResults.set(doc.id, {
                        ...doc,
                        textScore: 0,
                        semanticScore: doc.similarity * semanticWeight,
                        totalScore: doc.similarity * semanticWeight
                    });
                }
            });
            // Sort by total score and return top results
            const finalResults = Array.from(combinedResults.values())
                .sort((a, b) => b.totalScore - a.totalScore)
                .slice(0, limit);
            return finalResults;
        }
        catch (error) {
            console.error('[ERROR] Error in hybrid search:', error);
            throw error;
        }
    }
    // Semantic search with clustering (group similar results)
    searchWithClustering(queryEmbedding, limit = 10, similarityThreshold = 0.8) {
        try {
            const allResults = this.searchSimilar(queryEmbedding, limit * 3);
            const clusters = [];
            const processed = new Set();
            let clusterIndex = 0;
            // Helper to decode an embedding from the documents table (BLOB or JSON)
            const getEmbeddingForId = (id) => {
                const row = this.db.prepare('SELECT embedding FROM documents WHERE id = ?').get(id);
                if (!row || row.embedding == null)
                    return null;
                const data = row.embedding;
                if (Buffer.isBuffer(data)) {
                    const buf = data;
                    const float32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
                    return Array.from(float32);
                }
                try {
                    return JSON.parse(data);
                }
                catch {
                    return null;
                }
            };
            for (const doc of allResults) {
                if (processed.has(doc.id))
                    continue;
                const docEmbedding = getEmbeddingForId(doc.id);
                if (!docEmbedding) {
                    processed.add(doc.id);
                    continue;
                }
                const cluster = { cluster: clusterIndex++, documents: [doc] };
                processed.add(doc.id);
                // Find similar documents for this cluster
                for (const otherDoc of allResults) {
                    if (processed.has(otherDoc.id))
                        continue;
                    const otherEmbedding = getEmbeddingForId(otherDoc.id);
                    if (!otherEmbedding)
                        continue;
                    const similarity = this.cosineSimilarity(docEmbedding, otherEmbedding);
                    if (similarity >= similarityThreshold) {
                        cluster.documents.push(otherDoc);
                        processed.add(otherDoc.id);
                    }
                }
                clusters.push(cluster);
                if (clusters.length >= limit)
                    break;
            }
            return clusters;
        }
        catch (error) {
            console.error('[ERROR] Error in clustered search:', error);
            throw error;
        }
    }
    // Search with faceted results (group by time periods, similarity ranges, etc.)
    searchWithFacets(queryEmbedding, limit = 20) {
        try {
            const results = this.searchSimilar(queryEmbedding, limit);
            // Calculate similarity range facets
            const similarityRanges = [
                { range: '0.9-1.0', count: 0 },
                { range: '0.7-0.9', count: 0 },
                { range: '0.5-0.7', count: 0 },
                { range: '0.0-0.5', count: 0 }
            ];
            // Calculate time period facets
            const now = new Date();
            const timePeriods = [
                { period: 'Last 24 hours', count: 0 },
                { period: 'Last week', count: 0 },
                { period: 'Last month', count: 0 },
                { period: 'Older', count: 0 }
            ];
            results.forEach(doc => {
                // Similarity range facets
                if (doc.similarity >= 0.9)
                    similarityRanges[0].count++;
                else if (doc.similarity >= 0.7)
                    similarityRanges[1].count++;
                else if (doc.similarity >= 0.5)
                    similarityRanges[2].count++;
                else
                    similarityRanges[3].count++;
                // Time period facets
                const docDate = new Date(doc.created_at);
                const timeDiff = now.getTime() - docDate.getTime();
                const daysDiff = timeDiff / (1000 * 3600 * 24);
                if (daysDiff <= 1)
                    timePeriods[0].count++;
                else if (daysDiff <= 7)
                    timePeriods[1].count++;
                else if (daysDiff <= 30)
                    timePeriods[2].count++;
                else
                    timePeriods[3].count++;
            });
            return {
                results,
                facets: {
                    similarityRanges,
                    timePeriods
                }
            };
        }
        catch (error) {
            console.error('[ERROR] Error in faceted search:', error);
            throw error;
        }
    }
}
exports.SearchRepository = SearchRepository;
//# sourceMappingURL=search.repo.js.map