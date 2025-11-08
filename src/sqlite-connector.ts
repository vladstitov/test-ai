import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import * as path from 'path';

// Simple SQLite connector for this project
// - Opens (or creates) database.db by default
// - Loads sqlite-vec (required) and tries sqlite-vss (optional)
// - Ensures the 'funds' table exists

let DB:  Database.Database;

export async function connectDB(dbPath: string = 'database.db'): Promise<Database.Database> {
  console.log(`[INFO] Connecting to SQLite database: ${dbPath}`);

  const db = new Database(dbPath);

  // Require sqlite-vec extension; needed for vector ops and conversions
  try {
    sqliteVec.load(db);
    const row = db.prepare('SELECT vec_version() as v').get() as { v: string } | undefined;
    if (!row?.v) throw new Error('vec_version() unavailable');
    console.log(`[OK] sqlite-vec extension loaded${row?.v ? ` (v=${row.v})` : ''}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db.close();
    throw new Error(`[FATAL] sqlite-vec extension is required for vector operations: ${msg}`);
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
    console.warn(`[WARN] sqlite-vss (JS loader) not available: ${msg}`);
  }

  // (Removed native fallback loader for sqlite-vss)

  // Basic PRAGMAs
  try { db.exec('PRAGMA foreign_keys = ON;'); } catch {}

  DB = db; 
  return db;
}


export function createFundScema() {
  const db = DB;
  if (!db) return;
  console.log('creating fund table ')

  db.exec(`
    CREATE TABLE IF NOT EXISTS funds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      _id TEXT,
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
      embedding BLOB,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}export function deleteFundsSchema(): void {
  const db = DB
  if(!db) return
  console.warn('[WARN] dropping and creating tables...');
  try {
    db.exec('DROP TABLE IF EXISTS funds_vec;');
  } catch {}
  try {
    db.exec('DROP TABLE IF EXISTS funds;');
  } catch {}


}

// Utility: clear all known tables if they exist
export function clearAllData(db: Database.Database): void {
  try { db.exec('DELETE FROM funds;'); console.log('[OK] Cleared table: funds'); } catch {}
  try { db.exec('DELETE FROM funds_vec;'); console.log('[OK] Cleared table: funds_vss'); } catch {}
}
