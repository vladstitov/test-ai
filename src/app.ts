import { connectDB } from './sqlite-connector';
import { CrudRepository } from './crud.repo';
import { EmbeddingsService } from './embeddings.service';

// Example usage - call createDB when you need it
async function main(): Promise<void> {
  console.log('[INFO] Starting application...\n');

  try {
    // Connect to the persistent database
    const dbInstance = connectDB(); // Uses database.db

    // Create embeddings service
    const embeddingsService = new EmbeddingsService('nomic-embed-text');

    // Create CRUD repository with embeddings service
    const db = new CrudRepository(dbInstance, embeddingsService);

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

  } catch (error) {
    console.error('[ERROR] Application failed:', error);
  }
}

// Call the main function
if (require.main === module) {
  main().catch(console.error);
}
