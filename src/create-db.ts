import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

// ========================================
// TYPES AND INTERFACES
// ========================================

interface TableCreationResult {
  created: boolean;
}

// ========================================
// DATABASE CONNECTION AND INITIALIZATION
// ========================================

export function connectDB(): Database.Database {
  // Hardcoded persistent database path
  const persistentDbPath = 'database.db';
  console.log('[INFO] Connecting to SQLite Database with Vector Extension Support...\n');

  try {
    // Create/Connect to SQLite database
    const db = new Database(persistentDbPath);

    // Load sqlite-vec extension for native vector similarity search
    try {
      sqliteVec.load(db);
      console.log('[OK] sqlite-vec extension loaded successfully');
    } catch (error) {
      console.log('[WARN] sqlite-vec extension failed to load, using JSON fallback');
    }

    console.log('[OK] SQLite database connection established');

    // Check if tables exist, create if they don't
    const result = checkAndCreateTables(db);

    // Check VSS availability for logging
    let vssAvailable = false;
    try {
      db.exec('SELECT vec_version()');
      vssAvailable = true;
    } catch (error) {
      vssAvailable = false;
    }

    if (result.created) {
      console.log(`[OK] Database initialized successfully: ${persistentDbPath}`);
      console.log('[INFO] Database structure:');
      if (vssAvailable) {
        console.log('   - Table: documents (id, title, content, category, tags, embedding[BLOB], created_at)');
        console.log('   - Features: Native vector storage in documents table with VSS extension');
      } else {
        console.log('   - Table: documents (id, title, content, category, tags, embedding[TEXT], created_at)');
        console.log('   - Features: JSON embeddings stored in documents table');
      }
    } else {
      console.log(`[OK] Connected to existing database: ${persistentDbPath}`);
      console.log('[INFO] Using existing tables and data');
    }

    // Return the connected database instance
    return db;
  } catch (error) {
    console.error('[ERROR] Error connecting to database:', error);
    throw error;
  }
}

export function checkAndCreateTables(db: Database.Database): TableCreationResult {
  let tablesCreated = false;

  // Check if VSS extension is loaded
  let vssAvailable = false;
  try {
    db.exec('SELECT vec_version()');
    vssAvailable = true;
    console.log('[INFO] sqlite-vec extension available - using native vector storage');
  } catch (error) {
    console.log('[INFO] sqlite-vec extension not available, using JSON storage');
  }

  // Check if documents table exists
  const documentsTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='documents'
  `).get();

  // Create table only if it doesn't exist
  if (!documentsTableExists) {
    console.log('[INFO] Creating database tables...');

    if (vssAvailable) {
      // Create documents table with BLOB embedding column for VSS
      db.exec(`
        CREATE TABLE documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT,
          tags TEXT,
          embedding BLOB, -- Store embedding as BLOB for VSS
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[OK] Created documents table with BLOB embedding column (VSS mode)');
    } else {
      // Create documents table with TEXT embedding column for JSON fallback
      db.exec(`
        CREATE TABLE documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT,
          tags TEXT,
          embedding TEXT, -- Store embedding as JSON string
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[OK] Created documents table with TEXT embedding column (JSON mode)');
    }

    // Enable foreign keys
    db.exec('PRAGMA foreign_keys = ON;');

    console.log('[OK] Table created successfully');
    tablesCreated = true;
  } else {
    console.log('[OK] Database table already exists');
    // Still enable foreign keys
    db.exec('PRAGMA foreign_keys = ON;');
  }

  return { created: tablesCreated };
}

export function createTables(db: Database.Database): TableCreationResult {
  // Legacy function - now redirects to checkAndCreateTables
  return checkAndCreateTables(db);
}

