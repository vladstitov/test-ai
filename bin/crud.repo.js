"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrudRepository = void 0;
class CrudRepository {
    constructor(dbInstance, embeddingsService) {
        if (!dbInstance)
            throw new Error('Database instance is required');
        if (!embeddingsService)
            throw new Error('EmbeddingsService instance is required');
        this.db = dbInstance;
        this.embeddingsService = embeddingsService;
    }
    parseJsonList(jsonStr) {
        if (!jsonStr)
            return [];
        try {
            const arr = JSON.parse(jsonStr);
            return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
        }
        catch {
            return [];
        }
    }
    buildFundContent(r, opts = {}) {
        const { includeName = true } = opts;
        const aliases = this.parseJsonList(r.aliases);
        const industries = this.parseJsonList(r.industries);
        const parts = [];
        if (includeName)
            parts.push(`Name: ${r.name ?? 'Fund'}`);
        if (aliases.length)
            parts.push(`Aliases: ${aliases.join(', ')}`);
        if (r.manager)
            parts.push(`Manager: ${r.manager}`);
        if (r.status)
            parts.push(`Status: ${r.status}`);
        if (r.vintage != null)
            parts.push(`Vintage: ${r.vintage}`);
        if (r.strategy)
            parts.push(`Strategy: ${r.strategy}`);
        if (r.geography)
            parts.push(`Geography: ${r.geography}`);
        if (industries.length)
            parts.push(`Industries: ${industries.join(', ')}`);
        if (r.fundSize != null)
            parts.push(`Fund Size: ${r.fundSize}`);
        if (r.targetSize != null)
            parts.push(`Target Size: ${r.targetSize}`);
        return parts.join('\n');
    }
    fundRowToDocument(r) {
        const name = r.name ?? String(r._id);
        return { id: r.id, content: this.buildFundContent(r), createdAt: r.createdAt };
    }
    async generateQueryEmbedding(text) {
        return this.embeddingsService.generateEmbedding(text);
    }
    getEmbeddingsService() {
        return this.embeddingsService;
    }
    async generateAndStoreFundEmbeddingById(id) {
        try {
            const r = this.db
                .prepare(`SELECT id, _id, name, aliases, manager, vintage, strategy, geography, strategyGroup, geographyGroup,
                  fundSize, targetSize, status, industries
           FROM funds WHERE id = ?`)
                .get(id);
            if (!r)
                return false;
            //  const name = r.name ?? String(r._id);
            // const title = r.vintage != null ? `${name} (${r.vintage})` : name;
            const content = this.buildFundContent({
                name: r.name,
                aliases: r.aliases,
                manager: r.manager,
                vintage: r.vintage,
                strategy: r.strategy,
                geography: r.geography,
                fundSize: r.fundSize,
                targetSize: r.targetSize,
                status: r.status,
                industries: r.industries,
            }, { includeName: false });
            const embedding = await this.embeddingsService.generateEmbedding(content);
            if (!Array.isArray(embedding) || embedding.length === 0)
                return false;
            const blob = Buffer.from(new Float32Array(embedding).buffer);
            this.db.prepare('UPDATE funds SET embedding = ? WHERE id = ?').run(blob, id);
            try {
                this.db.prepare('INSERT OR REPLACE INTO funds_vec(rowid, embedding) VALUES (?, ?)').run(id, blob);
            }
            catch { }
            return true;
        }
        catch (error) {
            console.warn('[WARN] Failed to generate/store embedding for fund:', error.message);
            return false;
        }
    }
    insertFund(fund) {
        try {
            const aliasesJson = JSON.stringify(fund.aliases ?? []);
            const industriesJson = JSON.stringify(fund.industries ?? []);
            this.db
                .prepare(`INSERT OR IGNORE INTO funds (
             name, aliases, manager, vintage, strategy, geography, strategyGroup, geographyGroup, fundSize, targetSize, status, industries
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(fund.name ?? null, aliasesJson, fund.manager ?? null, fund.vintage ?? null, fund.strategy ?? null, fund.geography ?? null, fund.strategyGroup ?? null, fund.geographyGroup ?? null, fund.fundSize ?? null, fund.targetSize ?? null, fund.status ?? null, industriesJson);
            const row = this.db.prepare('SELECT id FROM funds WHERE id = ?').get(String(fund.id));
            const id = row?.id ?? 0;
            //if (id)/// console.log(`[OK] Fund upserted with ID: ${id}`);
            // else console.log('[WARN] Fund insert did not return an ID');
            return id;
        }
        catch (error) {
            console.error('[ERROR] Error inserting fund:', error);
            throw error;
        }
    }
    getAllDocuments() {
        try {
            const rows = this.db
                .prepare(`SELECT id, _id, name, aliases, manager, vintage, strategy, geography, strategyGroup, geographyGroup,
                  fundSize, targetSize, status, industries, createdAt AS createdAt
           FROM funds
           ORDER BY createdAt DESC`)
                .all();
            return rows.map((r) => this.fundRowToDocument(r));
        }
        catch (error) {
            console.error('[ERROR] Error getting documents:', error);
            throw error;
        }
    }
    deleteDocument(id) {
        try {
            const stmt = this.db.prepare('DELETE FROM funds WHERE id = ?');
            const result = stmt.run(id);
            if (result.changes > 0) {
                console.log(`[OK] Fund deleted with ID: ${id}`);
                return true;
            }
            console.log(`[WARN] No fund found with ID: ${id}`);
            return false;
        }
        catch (error) {
            console.error('[ERROR] Error deleting fund:', error);
            throw error;
        }
    }
    getDocumentById(id) {
        try {
            const r = this.db
                .prepare(`SELECT id, _id, name, aliases, manager, vintage, strategy, geography, strategyGroup, geographyGroup,
                  fundSize, targetSize, status, industries, createdAt AS createdAt
           FROM funds WHERE id = ?`)
                .get(id);
            if (!r)
                return null;
            return this.fundRowToDocument(r);
        }
        catch (error) {
            console.error('[ERROR] Error getting fund by ID:', error);
            throw error;
        }
    }
    getEmbeddingByDocumentId(documentId) {
        try {
            const row = this.db.prepare('SELECT embedding FROM funds WHERE id = ?').get(documentId);
            if (!row || row.embedding == null)
                return null;
            const raw = row.embedding;
            const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
            if (buf.byteLength === 0)
                return null;
            if (buf.byteLength % 4 !== 0)
                return null;
            return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
        }
        catch (error) {
            console.warn('[WARN] Failed to read embedding:', error.message);
            return null;
        }
    }
    updateEmbedding(_documentId, _newEmbedding) {
        console.log('[INFO] updateEmbedding is deprecated; use generateAndStoreFundEmbeddingById');
        return false;
    }
    getStats() {
        try {
            const fundCount = this.db.prepare('SELECT COUNT(*) as count FROM funds').get();
            let embCount = { count: 0 };
            try {
                embCount = this.db.prepare('SELECT COUNT(*) as count FROM funds WHERE LENGTH(embedding) > 0').get();
            }
            catch { }
            return { documents: fundCount.count, embeddings: embCount.count, orphaned_documents: 0 };
        }
        catch (error) {
            console.error('[ERROR] Error getting stats:', error);
            throw error;
        }
    }
    getDatabaseSchema() {
        try {
            return {
                tables: {
                    documents: {
                        columns: [
                            'id',
                            '_id',
                            'name',
                            'aliases',
                            'manager',
                            'vintage',
                            'strategy',
                            'geography',
                            'strategyGroup',
                            'geographyGroup',
                            'fundSize',
                            'targetSize',
                            'status',
                            'industries',
                            'createdAt',
                        ],
                        description: 'Funds table storing raw Mongo fields (aliases, industries as JSON strings)',
                    },
                    embeddings: { columns: [], description: 'Embeddings stored in funds (BLOB) and optionally funds_vec' },
                },
                relationships: [],
                indexes: [],
            };
        }
        catch (error) {
            console.error('[ERROR] Error getting database schema:', error);
            throw error;
        }
    }
    getStrategies() {
        try {
            const rows = this.db
                .prepare("SELECT DISTINCT strategy as s FROM funds WHERE strategy IS NOT NULL AND TRIM(strategy) <> '' ORDER BY strategy ASC")
                .all();
            return rows.map((r) => r.s);
        }
        catch (error) {
            console.error('[ERROR] Error getting strategies:', error);
            throw error;
        }
    }
    getGeographies() {
        try {
            const rows = this.db
                .prepare("SELECT DISTINCT geography as g FROM funds WHERE geography IS NOT NULL AND TRIM(geography) <> '' ORDER BY geography ASC")
                .all();
            return rows.map((r) => r.g);
        }
        catch (error) {
            console.error('[ERROR] Error getting geographies:', error);
            throw error;
        }
    }
}
exports.CrudRepository = CrudRepository;
//# sourceMappingURL=crud.repo.js.map