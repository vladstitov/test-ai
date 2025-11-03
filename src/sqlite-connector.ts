import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

// Simple SQLite connector for this project
// - Opens (or creates) database.db by default
// - Attempts to load sqlite-vec extension (optional)
// - Ensures the 'funds' table exists, matching CrudRepository expectations

export function connectDB(dbPath: string = 'database.db'): Database.Database {
  console.log(`[INFO] Connecting to SQLite database: ${dbPath}`);

  const db = new Database(dbPath);

  // Try loading sqlite-vec extension if available and verify
  let vssAvailable = false;
  try {
    sqliteVec.load(db);
    const row = db.prepare("SELECT vec_version() as v").get() as { v: string } | undefined;
    vssAvailable = !!row?.v;
    console.log(`[OK] sqlite-vec extension loaded${row?.v ? ` (v=${row.v})` : ''}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('[INFO] sqlite-vec extension not available; continuing without it');
    console.log(`[INFO] Reason: ${msg}`);
  }

  // Basic PRAGMAs
  try {
    db.exec('PRAGMA foreign_keys = ON;');
  } catch {
    /* ignore */
  }

  // Ensure 'funds' table exists (schema aligned with CrudRepository.insertFund)
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
        embedding ${vssAvailable ? 'BLOB' : 'TEXT'},
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_funds__id ON funds(_id);
    `);
    console.log('[OK] Funds table created');
  } else {
    console.log('[OK] Funds table present');

    // Ensure 'embedding' column exists; add it if missing
    try {
      const cols = db.prepare("PRAGMA table_info(funds)").all() as Array<{ name: string }>;
      const hasEmbedding = cols.some(c => c.name.toLowerCase() === 'embedding');
      if (!hasEmbedding) {
        console.log(`[INFO] Adding 'embedding' column to funds table as ${vssAvailable ? 'BLOB' : 'TEXT'}...`);
        db.exec(`ALTER TABLE funds ADD COLUMN embedding ${vssAvailable ? 'BLOB' : 'TEXT'};`);
        console.log('[OK] Column added');
      }
    } catch (err) {
      console.log('[WARN] Could not verify/add embedding column on funds:', (err as Error).message);
    }
  }

  return db;
}
