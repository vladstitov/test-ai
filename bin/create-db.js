"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.checkAndCreateTables = checkAndCreateTables;
exports.createTables = createTables;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const sqliteVec = __importStar(require("sqlite-vec"));
// ========================================
// DATABASE CONNECTION AND INITIALIZATION
// ========================================
function connectDB() {
    // Hardcoded persistent database path
    const persistentDbPath = 'database.db';
    console.log('[INFO] Connecting to SQLite Database with Vector Extension Support...\n');
    try {
        // Create/Connect to SQLite database
        const db = new better_sqlite3_1.default(persistentDbPath);
        // Load sqlite-vec extension for native vector similarity search
        try {
            sqliteVec.load(db);
            console.log('[OK] sqlite-vec extension loaded successfully');
        }
        catch (error) {
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
        }
        catch (error) {
            vssAvailable = false;
        }
        if (result.created) {
            console.log(`[OK] Database initialized successfully: ${persistentDbPath}`);
            console.log('[INFO] Database structure:');
            if (vssAvailable) {
                console.log('   - Table: documents (id, title, content, embedding[BLOB], created_at)');
                console.log('   - Features: Native vector storage in documents table with VSS extension');
            }
            else {
                console.log('   - Table: documents (id, title, content, embedding[TEXT], created_at)');
                console.log('   - Features: JSON embeddings stored in documents table');
            }
        }
        else {
            console.log(`[OK] Connected to existing database: ${persistentDbPath}`);
            console.log('[INFO] Using existing tables and data');
        }
        // Return the connected database instance
        return db;
    }
    catch (error) {
        console.error('[ERROR] Error connecting to database:', error);
        throw error;
    }
}
function checkAndCreateTables(db) {
    let tablesCreated = false;
    // Check if VSS extension is loaded
    let vssAvailable = false;
    try {
        db.exec('SELECT vec_version()');
        vssAvailable = true;
        console.log('[INFO] sqlite-vec extension available - using native vector storage');
    }
    catch (error) {
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
          embedding BLOB, -- Store embedding as BLOB for VSS
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            console.log('[OK] Created documents table with BLOB embedding column (VSS mode)');
        }
        else {
            // Create documents table with TEXT embedding column for JSON fallback
            db.exec(`
        CREATE TABLE documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
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
    }
    else {
        console.log('[OK] Database table already exists');
        // Still enable foreign keys
        db.exec('PRAGMA foreign_keys = ON;');
    }
    // Create funds table to mirror MongoDB fund fields
    const fundsTableExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='funds'
  `).get();
    if (!fundsTableExists) {
        console.log('[INFO] Creating funds table for Mongo fields...');
        db.exec(`
      CREATE TABLE funds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        _id TEXT UNIQUE,                -- MongoDB document _id as string
        name TEXT,
        aliases TEXT,                   -- JSON array as string
        fundType TEXT,
        vintage INTEGER,
        strategy TEXT,
        geography TEXT,
        strategyGroup TEXT,
        geographyGroup TEXT,
        fundSize REAL,
        targetSize REAL,
        status TEXT,
        industries TEXT,                -- JSON array as string
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_funds__id ON funds(_id);`);
        console.log('[OK] Created funds table');
        tablesCreated = true;
    }
    else {
        console.log('[OK] Funds table already exists');
    }
    return { created: tablesCreated };
}
function createTables(db) {
    // Legacy function - now redirects to checkAndCreateTables
    return checkAndCreateTables(db);
}
//# sourceMappingURL=create-db.js.map