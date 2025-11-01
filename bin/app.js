"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const create_db_1 = require("./create-db");
const crud_repo_1 = require("./crud.repo");
const embeddings_service_1 = require("./embeddings.service");
// Example usage - call createDB when you need it
async function main() {
    console.log('[INFO] Starting application...\n');
    try {
        // Connect to the persistent database
        const dbInstance = (0, create_db_1.connectDB)(); // Always uses database.db
        // Create embeddings service
        const embeddingsService = new embeddings_service_1.EmbeddingsService('nomic-embed-text');
        // Create CRUD repository with embeddings service
        const db = new crud_repo_1.CrudRepository(dbInstance, embeddingsService);
        console.log('\n[INFO] Database is ready! You can now:');
        console.log('   - Insert documents');
        console.log('   - Search for similar documents');
        console.log('   - Perform vector operations');
        // Example: Insert a document (embedding generated automatically)
        const docId = await db.insertDocument('Sample Document', 'This is a test document');
        console.log(`[OK] Inserted document with ID: ${docId}`);
        // Get all documents
        const docs = db.getAllDocuments();
        console.log(`\n[INFO] Documents in database: ${docs.length}`);
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