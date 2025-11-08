"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertFundsFromMongo = insertFundsFromMongo;
const sqlite_connector_1 = require("./sqlite-connector");
const crud_repo_1 = require("./crud.repo");
const mongo_connector_1 = require("./mongo-connector");
const embeddings_service_1 = require("./embeddings.service");
async function insertFundsFromMongo(dbRepo, opts) {
    let batches = 0;
    let offset = 0;
    let totalInserted = 0;
    // If a global limit is provided, cap the total we fetch
    const totalLimit = Number.isFinite(Number(opts.limit)) ? Number(opts.limit) : Infinity;
    console.log(`[INFO] Loading funds from MongoDB `);
    while (batches < opts.maxBatches) {
        console.log('offset' + offset);
        const docs = await (0, mongo_connector_1.getFunds)(offset, opts.limit);
        const count = docs.length;
        if (count === 0)
            break;
        batches++;
        for (const f of docs) {
            try {
                const id = dbRepo.insertFund(f);
                // Generate and store embedding per fund (best-effort)
                await dbRepo.generateAndStoreFundEmbeddingById(id);
                totalInserted++;
                console.log(`   Inserted ${totalInserted} documents so far...`);
            }
            catch (err) {
                const name = (f && (f.name || f._id)) ? String(f.name ?? f._id) : 'unknown';
                console.error(`[ERROR] Failed to insert fund ${name}:`, err.message);
            }
        }
        offset += opts.limit;
    }
    return { inserted: totalInserted, batches };
}
// Optional CLI entrypoint for convenience
async function main() {
    // Get SQLite connection via connector (loads sqlite-vec if available, ensures funds table)
    const db = await (0, sqlite_connector_1.connectDB)();
    // Clear existing data from funds before loading
    try {
        console.log('[WARN] Clearing existing records from funds table...');
        db.exec('DELETE FROM funds;');
        // Optional: reset AUTOINCREMENT sequence
        try {
            db.exec("DELETE FROM sqlite_sequence WHERE name='funds';");
        }
        catch { }
        console.log('[OK] Funds table cleared');
    }
    catch (e) {
        console.error('[ERROR] Failed to clear funds table:', e.message);
        throw e;
    }
    const embeddings = new embeddings_service_1.EmbeddingsService();
    const repo = new crud_repo_1.CrudRepository(db, embeddings);
    const limit = 10;
    await insertFundsFromMongo(repo, { limit, offset: 0, maxBatches: 1 });
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