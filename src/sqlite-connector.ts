import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

// Simple SQLite connector for this project
// - Opens (or creates) database.db by default
// - Loads sqlite-vec (required) and tries sqlite-vss (optional)
// - Ensures the 'funds' table exists

export async function connectDB(dbPath: string = 'database.db'): Promise<Database.Database> {
  console.log(`[INFO] Connecting to SQLite database: ${dbPath}`);

  const db = new Database(dbPath);

  // Require sqlite-vec extension; abort if unavailable
  try {
    sqliteVec.load(db);
    const row = db.prepare('SELECT vec_version() as v').get() as { v: string } | undefined;
    if (!row?.v) throw new Error('vec_version() unavailable');
    console.log(`[OK] sqlite-vec extension loaded${row?.v ? ` (v=${row.v})` : ''}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db.close();
    throw new Error(`[FATAL] sqlite-vec extension is required for embeddings: ${msg}`);
  }

  // Try to load sqlite-vss for ANN vector search; continue if unavailable
  let vssLoaded = false;
  try {
    const sqliteVss: any = await (new Function('m', 'return import(m)'))('sqlite-vss');
    sqliteVss.load(db);
    const row = db.prepare('SELECT vss_version() as v').get() as { v?: string } | undefined;
    vssLoaded = !!row?.v;
    if (vssLoaded) console.log(`[OK] sqlite-vss extension loaded${row?.v ? ` (v=${row.v})` : ''}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[WARN] sqlite-vss extension not available; vector search disabled: ${msg}`);
  }

  // Basic PRAGMAs
  try { db.exec('PRAGMA foreign_keys = ON;'); } catch {}

  // Ensure 'funds' table exists
  const fundsTableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='funds'"
  ).get();

  if (!fundsTableExists) {
    console.log('[INFO] Creating funds table...');
    db.exec(`
      CREATE TABLE funds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        _id TEXT UNIQUE,
        name TEXT,
        aliases TEXT,
        manager TEXT,
        vintage INTEGER,
        strategy TEXT,
        geography TEXT,
        strategyGroup TEXT,
        geographyGroup TEXT,
        fundSize REAL,
        targetSize REAL,
        status TEXT,
        industries TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_funds__id ON funds(_id);
    `);
    console.log('[OK] Funds table created');

    if (vssLoaded) {
      try {
        db.exec(`CREATE VIRTUAL TABLE funds_vss USING vss0(embedding(768));`);
        console.log('[OK] funds_vss created');
      } catch (e) {
        console.warn('[WARN] Could not create funds_vss:', (e as Error).message);
      }
    }
  } else {
    console.log('[OK] Funds table present');

    try {
      const cols = db.prepare('PRAGMA table_info(funds)').all() as Array<{ name: string }>;
      // Ensure 'manager' column exists; add it if missing
      const hasManager = cols.some(c => c.name === 'manager');
      if (!hasManager) {
        console.log("[INFO] Adding 'manager' column to funds table as TEXT...");
        try { db.exec('ALTER TABLE funds ADD COLUMN manager TEXT;'); console.log('[OK] manager column added'); }
        catch (e) { console.warn('[WARN] Could not add manager column:', (e as Error).message); }
      }

      // No created_at migration needed; schema uses createdAt from the start

      // Ensure VSS virtual table exists if vss is loaded
      if (vssLoaded) {
        try {
          const vtab = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='funds_vss'").get();
          if (!vtab) {
            console.log('[INFO] Creating funds_vss virtual table...');
            db.exec(`CREATE VIRTUAL TABLE funds_vss USING vss0(embedding(768));`);
            console.log('[OK] funds_vss created');
          }
        } catch (e) {
          console.warn('[WARN] Could not ensure funds_vss table:', (e as Error).message);
        }
      }
    } catch (err) {
      console.log('[WARN] Could not verify/alter funds table:', (err as Error).message);
    }
  }

  return db;
}
