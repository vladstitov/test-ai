import { connectDB, createFundScema, deleteFundsSchema} from './sqlite-connector';
import { CrudRepository } from './crud.repo';
import { QdrantRepository } from './qdrant.repo';
import { dropAndCreateCollection } from './qdrant-connector';
import { getFunds /*, getPrices*/ } from './mongo-connector';
import { EmbeddingsService } from './embeddings.service';
import { getOllama } from './ollama-singleton';
import type { IOFundModel } from './fund.types';

interface LoadOptions {
  offset: number; 
  limit: number
  maxBatches: number; 
}

export async function insertFundsFromMongo(dbRepo: QdrantRepository, opts: LoadOptions): Promise<{ inserted: number;  batches: number; }> {
  
  let batches = 0;
  let offset = 0
  let totalInserted = 0

  // If a global limit is provided, cap the total we fetch
  const totalLimit = Number.isFinite(Number(opts.limit)) ? Number(opts.limit) : Infinity;

  console.log(`[INFO] Loading funds from MongoDB `);


  while (batches < opts.maxBatches ) {
    console.log('offset' + offset)
   
    const docs = await getFunds(offset, opts.limit);
    const count = docs.length;
    if (count === 0) break;   
    batches++;

    for (const f of docs as IOFundModel[]) {
      try {
        const id = await dbRepo.insertFund(f);
        totalInserted ++;        
        console.log(` Inserted ${totalInserted}  id ${id}`);
        
      } catch (err) {
        const name = (f && (f.name)) ? String((f as any).name ?? (f as any)._id) : 'unknown';
        console.error(`[ERROR] Failed to insert fund ${name}:`, (err as Error).message);
      }
    }

    offset += opts.limit;
  }

 
  return { inserted: totalInserted,  batches };
}

// Optional CLI entrypoint for convenience
async function main(): Promise<void> {
  // Get SQLite connection via connector
  ///const db = await connectDB();
  const embeddings = new EmbeddingsService();


  const repo =  new QdrantRepository('funds', embeddings)
  // Reset the 'funds' collection to start fresh
  await dropAndCreateCollection('funds', 768);


  const limit: number = 1000;
   

  await insertFundsFromMongo(repo, { limit, offset:0,  maxBatches: 200 });

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
