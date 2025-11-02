"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertFundsFromMongo = insertFundsFromMongo;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const crud_repo_1 = require("./crud.repo");
const mongo_connector_1 = require("./mongo-connector");
const embeddings_service_1 = require("./embeddings.service");
async function insertFundsFromMongo(dbRepo, opts = {}) {
    const pageSize = Math.max(1, Number(opts.pageSize ?? 100));
    let offset = Math.max(0, Number(opts.offset ?? 0));
    const maxBatches = Number.isFinite(Number(opts.maxBatches)) ? Number(opts.maxBatches) : Infinity;
    const dryRun = !!opts.dryRun;
    let totalInserted = 0;
    let totalFetched = 0;
    let batches = 0;
    // If a global limit is provided, cap the total we fetch
    const totalLimit = Number.isFinite(Number(opts.limit)) ? Number(opts.limit) : Infinity;
    console.log(`[INFO] Loading funds from MongoDB in pages of ${pageSize} (dryRun=${dryRun})`);
    while (batches < maxBatches && totalFetched < totalLimit) {
        const remaining = isFinite(totalLimit) ? Math.max(0, totalLimit - totalFetched) : pageSize;
        const thisPage = Math.min(pageSize, remaining || pageSize);
        const docs = await (0, mongo_connector_1.getFunds)(offset, thisPage);
        const count = docs.length;
        if (count === 0)
            break;
        totalFetched += count;
        batches++;
        for (const f of docs) {
            try {
                if (dryRun) {
                    const summary = [
                        `name=${f.name ?? '-'}`,
                        `fundType=${f.fundType ?? '-'}`,
                        `status=${f.status ?? '-'}`,
                        `vintage=${f.vintage ?? '-'}`
                    ].join(' | ');
                    console.log(`[DRY] ${String(f._id)} | ${summary}`);
                    continue;
                }
                dbRepo.insertFund(f);
                totalInserted++;
                if (totalInserted % 10 === 0) {
                    console.log(`   Inserted ${totalInserted} documents so far...`);
                }
            }
            catch (err) {
                const name = (f && (f.name || f._id)) ? String(f.name ?? f._id) : 'unknown';
                console.error(`[ERROR] Failed to insert fund ${name}:`, err.message);
            }
        }
        offset += count;
    }
    console.log(`[OK] Funds load complete: fetched=${totalFetched}, inserted=${totalInserted}, batches=${batches}`);
    return { inserted: totalInserted, fetched: totalFetched, batches };
}
// Optional CLI entrypoint for convenience
async function main() {
    // Local SQLite connection (no external init module)
    const db = new better_sqlite3_1.default('database.db');
    // Ensure 'funds' table exists
    const fundsTableExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='funds'
  `).get();
    if (!fundsTableExists) {
        console.log('[INFO] Creating funds table...');
        db.exec(`
      CREATE TABLE funds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        _id TEXT UNIQUE,
        name TEXT,
        aliases TEXT,
        fundType TEXT,
        vintage INTEGER,
        strategy TEXT,
        geography TEXT,
        strategyGroup TEXT,
        geographyGroup TEXT,
        fundSize REAL,
        targetSize REAL,
        status TEXT,
        industries TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_funds__id ON funds(_id);
    `);
        console.log('[OK] Funds table created');
    }
    const embeddings = new embeddings_service_1.EmbeddingsService('nomic-embed-text');
    const repo = new crud_repo_1.CrudRepository(db, embeddings);
    const pageSize = Number(process.env.PAGE_SIZE ?? 100);
    const offset = Number(process.env.OFFSET ?? 0);
    const limitEnv = process.env.LIMIT;
    const limit = limitEnv !== undefined ? Number(limitEnv) : undefined;
    const maxBatchesEnv = process.env.MAX_BATCHES;
    const maxBatches = maxBatchesEnv !== undefined ? Number(maxBatchesEnv) : undefined;
    const dryRun = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
    await insertFundsFromMongo(repo, { pageSize, offset, limit, maxBatches, dryRun });
    const stats = repo.getStats();
    console.log('[INFO] Database Stats after import:');
    console.log(`   Documents: ${stats.documents}`);
    console.log(`   With Embeddings: ${stats.embeddings}`);
}
if (require.main === module) {
    main().catch((e) => {
        console.error('[FATAL] Import failed:', e);
        process.exit(1);
    });
}
//# sourceMappingURL=load-real-data.js.map