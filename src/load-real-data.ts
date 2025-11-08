import { connectDB, createFundScema, deleteFundsSchema} from './sqlite-connector';
import { CrudRepository } from './crud.repo';
import { getFunds /*, getPrices*/ } from './mongo-connector';
import { EmbeddingsService } from './embeddings.service';
import { getOllama } from './ollama-singleton';
import type { IOFundModel } from './fund.types';

interface LoadOptions {
  offset: number; 
  limit: number
  maxBatches: number; 
}

export async function insertFundsFromMongo(dbRepo: CrudRepository, opts: LoadOptions): Promise<{ inserted: number;  batches: number; }> {
  
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
        const id = dbRepo.insertFund(f);
        // Generate and store embedding per fund (best-effort)
        await dbRepo.generateAndStoreFundEmbeddingById(id);
        totalInserted ++;
       
        console.log(` Inserted ${totalInserted}  id ${id}`);
        
      } catch (err) {
        const name = (f && (f.name || f._id)) ? String((f as any).name ?? (f as any)._id) : 'unknown';
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
  const db = await connectDB();
  // Drop and recreate schema on each run
  deleteFundsSchema();
  createFundScema() 
  const embeddings = new EmbeddingsService();
  const repo = new CrudRepository(db, embeddings);


  const limit: number = 1000;
   

  await insertFundsFromMongo(repo, { limit, offset:0,  maxBatches: 200 });

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
