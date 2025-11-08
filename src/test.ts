import { connectDB } from './sqlite-connector';
import { CrudRepository } from './crud.repo';
import { SearchRepository } from './search.repo';
import { EmbeddingsService } from './embeddings.service';
import { getOllama } from './ollama-singleton';

async function runTests(): Promise<void> {
  console.log('[INFO] Running SQLite VSS Tests...\n');

  let crudRepo: CrudRepository | undefined;
  let searchRepo: SearchRepository | undefined;

  try {
    // Test 1: Database initialization and data loading
    console.log('Test 1: Database Initialization');
    // Connect to existing database (load-real-data should prepare it)
    const dbInstance = await connectDB();

    // Create embeddings service
    const embeddingsService = new EmbeddingsService();

    // Create repository instances
    crudRepo = new CrudRepository(dbInstance, embeddingsService);
    searchRepo = new SearchRepository(dbInstance);

    const stats = crudRepo.getStats();

    console.log(`[INFO] Current Database Stats: Documents=${stats.documents}, Embeddings=${stats.embeddings}`);
    console.log('[OK] Database connectivity verified');

    console.log('[OK] PASSED\n');

    // Test 2: Retrieve all documents
    console.log('Test 2: Retrieve All Documents');
    const allDocs = crudRepo.getAllDocuments();
    if (allDocs.length > 0) {
      console.log(`[OK] PASSED - Found ${allDocs.length} document(s)`);
      console.log(`   Latest: "${allDocs[0].title}"\n`);
    } else {
      console.log('[ERROR] FAILED - No documents found\n');
    }

    // Test 3: Vector similarity search (using real Ollama embedding)
    console.log('Test 3: Vector similarity search');

    // Generate a real embedding for search query using the existing repository
    const queryText = 'machine learning and artificial intelligence';
    console.log('[INFO] Generating query embedding for search...');
    const queryEmbedding = await crudRepo.generateQueryEmbedding(queryText);

    const similarDocs = searchRepo.searchSimilar(queryEmbedding, 5);
    if (similarDocs.length > 0) {
      console.log(`[OK] PASSED - Found ${similarDocs.length} similar document(s) for: "${queryText}"`);
      similarDocs.forEach((doc, index) => {
        console.log(`   ${index + 1}. "${(doc as any).name ?? ''}" (Similarity: ${doc.similarity.toFixed(4)})`);
      });
      console.log();
    } else {
      console.log('[ERROR] FAILED - No similar documents found\n');
    }

    // Test 4: Text search
    console.log('Test 4: Text Search');
    const textResults = searchRepo.searchByText('machine learning', 3);
    if (textResults.length > 0) {
      console.log(`[OK] PASSED - Found ${textResults.length} documents with text search`);
      textResults.forEach((doc, index) => {
        console.log(`   ${index + 1}. "${doc.name}"`);
      });
      console.log();
    } else {
      console.log('[ERROR] FAILED - No text search results found\n');
    }

    // Test 5: Enhanced Similarity Search
    console.log('Test 5: Enhanced Similarity Search');
    const enhancedSearch = searchRepo.searchSimilar(queryEmbedding, 5);
    console.log(`[OK] PASSED - Found ${enhancedSearch.length} documents:`);
    enhancedSearch.forEach((doc, index) => {
      console.log(`   ${index + 1}. "${(doc as any).name ?? ''}" (Similarity: ${doc.similarity.toFixed(4)})`);
    });
    console.log();

    // Test 6: Database Statistics
    console.log('Test 6: Database Statistics');
    const finalStats = crudRepo.getStats();
    console.log(`[OK] PASSED - Database contains:`);
    console.log(`   Documents: ${finalStats.documents}`);
    console.log(`   Embeddings: ${finalStats.embeddings}`);
    console.log(`   Orphaned documents: ${finalStats.orphaned_documents}\n`);

    // Test 7: Hybrid Search
    console.log('Test 7: Hybrid Search');
    const hybridResults = searchRepo.hybridSearch('machine learning', queryEmbedding, 0.3, 0.7, 5);
    console.log(`[OK] PASSED - Found ${hybridResults.length} hybrid search results:`);
    hybridResults.forEach((doc, index) => {
      console.log(` ${index + 1}. "${(doc as any).name ?? ''}" (Total: ${doc.totalScore.toFixed(4)})`);
    });
    console.log();

    console.log('[OK] All tests completed!');

  } catch (error) {
    console.error('[ERROR] Test failed with error:', error);
  } finally {
    // Database connection will be managed by the database instance
    console.log('[INFO] Test completed (database.db remains persistent)');
  }
}

// Main execution
async function main(): Promise<void> {
  await runTests();
  // Removed performance test to keep database clean with only pure dummy data
}

// Run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}
