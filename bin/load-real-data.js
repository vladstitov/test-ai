"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertFundsFromMongo = insertFundsFromMongo;
const qdrant_repo_1 = require("./qdrant.repo");
const qdrant_connector_1 = require("./qdrant-connector");
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
                const id = await dbRepo.insertFund(f);
                totalInserted++;
                console.log(` Inserted ${totalInserted}  id ${id}`);
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
    // Get SQLite connection via connector
    ///const db = await connectDB();
    const embeddings = new embeddings_service_1.EmbeddingsService();
    const repo = new qdrant_repo_1.QdrantRepository('funds', embeddings);
    // Reset the 'funds' collection to start fresh
    await (0, qdrant_connector_1.dropAndCreateCollection)('funds', 768);
    const limit = 1000;
    await insertFundsFromMongo(repo, { limit, offset: 0, maxBatches: 200 });
    const stats = await (repo.getStats?.() ?? { documents: 0, embeddings: 0, orphaned_documents: 0 });
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