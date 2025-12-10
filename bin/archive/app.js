"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite_connector_1 = require("./sqlite-connector");
const crud_repo_1 = require("../crud.repo");
const embeddings_service_1 = require("../embeddings.service");
// Example usage - call createDB when you need it
async function main() {
    console.log('[INFO] Starting application...\n');
    try {
        // Connect to the persistent database
        const dbInstance = await (0, sqlite_connector_1.connectDB)(); // Uses database.db
        // Create embeddings service
        const embeddingsService = new embeddings_service_1.EmbeddingsService();
        // Create CRUD repository with embeddings service
        const db = new crud_repo_1.CrudRepository(dbInstance, embeddingsService);
        console.log('\n[INFO] Database is ready! You can now:');
        console.log('   - Load funds via load-real-data.ts');
        console.log('   - List funds and run text search');
        // Get all documents
        const docs = db.getAllDocuments();
        console.log(`\n[INFO] Funds in database: ${docs.length}`);
        if (docs.length > 0) {
            console.log(`   Latest fund: "${docs[0].title}"`);
        }
        // Database connection managed by the dbInstance
        console.log('[OK] Application completed successfully');
    }
    catch (error) {
        console.error('[ERROR] Application failed:', error);
    }
}
// Call the main function
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=app.js.map