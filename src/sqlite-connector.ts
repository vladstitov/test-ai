import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

// Simple SQLite connector for this project
// - Opens (or creates) database.db by default
// - Attempts to load sqlite-vec extension (optional)
// - Ensures the 'funds' table exists, matching CrudRepository expectations

export function connectDB(dbPath: string = 'database.db'): Database.Database {
  console.log(`[INFO] Connecting to SQLite database: ${dbPath}`);

  const db = new Database(dbPath);

  // Try loading sqlite-vec extension if available
  try {
    sqliteVec.load(db);
    console.log('[OK] sqlite-vec extension loaded');
  } catch {
    console.log('[INFO] sqlite-vec extension not available; continuing without it');
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_funds__id ON funds(_id);
    `);
    console.log('[OK] Funds table created');
  } else {
    console.log('[OK] Funds table present');
  }

  return db;
}

