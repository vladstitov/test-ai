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
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const sqliteVec = __importStar(require("sqlite-vec"));
// Simple SQLite connector for this project
// - Opens (or creates) database.db by default
// - Attempts to load sqlite-vec extension (optional)
// - Ensures the 'funds' table exists, matching CrudRepository expectations
function connectDB(dbPath = 'database.db') {
    console.log(`[INFO] Connecting to SQLite database: ${dbPath}`);
    const db = new better_sqlite3_1.default(dbPath);
    // Try loading sqlite-vec extension if available
    try {
        sqliteVec.load(db);
        console.log('[OK] sqlite-vec extension loaded');
    }
    catch {
        console.log('[INFO] sqlite-vec extension not available; continuing without it');
    }
    // Basic PRAGMAs
    try {
        db.exec('PRAGMA foreign_keys = ON;');
    }
    catch {
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
    }
    else {
        console.log('[OK] Funds table present');
    }
    return db;
}
//# sourceMappingURL=sqlite-connector.js.map