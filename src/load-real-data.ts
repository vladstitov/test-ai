import Database from 'better-sqlite3';
import { CrudRepository } from './crud.repo';
import { getFunds /*, getPrices*/ } from './mongo-connector';
import { EmbeddingsService } from './embeddings.service';
import type { IOFundModel } from './fund.types';

interface LoadOptions {
  offset?: number;
  limit?: number;
  pageSize?: number;
  maxBatches?: number;
  dryRun?: boolean;
}

export async function insertFundsFromMongo(dbRepo: CrudRepository, opts: LoadOptions = {}): Promise<{ inserted: number; fetched: number; batches: number; }> {
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
    const docs = await getFunds(offset, thisPage);
    const count = docs.length;
    if (count === 0) break;
    totalFetched += count;
    batches++;

    for (const f of docs as IOFundModel[]) {
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
      } catch (err) {
        const name = (f && (f.name || f._id)) ? String((f as any).name ?? (f as any)._id) : 'unknown';
        console.error(`[ERROR] Failed to insert fund ${name}:`, (err as Error).message);
      }
    }

    offset += count;
  }

  console.log(`[OK] Funds load complete: fetched=${totalFetched}, inserted=${totalInserted}, batches=${batches}`);
  return { inserted: totalInserted, fetched: totalFetched, batches };
}

// Optional CLI entrypoint for convenience
async function main(): Promise<void> {
  // Local SQLite connection (no external init module)
  const db = new Database('database.db');
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
  const embeddings = new EmbeddingsService('nomic-embed-text');
  const repo = new CrudRepository(db, embeddings);

  const pageSize: number = Number(process.env.PAGE_SIZE ?? 100);
  const offset: number = Number(process.env.OFFSET ?? 0);
  const limitEnv = process.env.LIMIT;
  const limit: number | undefined = limitEnv !== undefined ? Number(limitEnv) : undefined;
  const maxBatchesEnv = process.env.MAX_BATCHES;
  const maxBatches: number | undefined = maxBatchesEnv !== undefined ? Number(maxBatchesEnv) : undefined;
  const dryRun: boolean = String(process.env.DRY_RUN || '').toLowerCase() === 'true';

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
