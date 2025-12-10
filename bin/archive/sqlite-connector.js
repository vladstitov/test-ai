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
exports.createFundScema = createFundScema;
exports.deleteFundsSchema = deleteFundsSchema;
exports.clearAllData = clearAllData;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const sqliteVec = __importStar(require("sqlite-vec"));
// Simple SQLite connector for this project
// - Opens (or creates) database.db by default
// - Loads sqlite-vec (required) and tries sqlite-vss (optional)
// - Ensures the 'funds' table exists
let DB;
async function connectDB(dbPath = 'database.db') {
    console.log(`[INFO] Connecting to SQLite database: ${dbPath}`);
    const db = new better_sqlite3_1.default(dbPath);
    // Require sqlite-vec extension; needed for vector ops and conversions
    try {
        sqliteVec.load(db);
        const row = db.prepare('SELECT vec_version() as v').get();
        if (!row?.v)
            throw new Error('vec_version() unavailable');
        console.log(`[OK] sqlite-vec extension loaded${row?.v ? ` (v=${row.v})` : ''}`);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        db.close();
        throw new Error(`[FATAL] sqlite-vec extension is required for vector operations: ${msg}`);
    }
    // Try to load sqlite-vss for ANN vector search; continue if unavailable
    let vssLoaded = false;
    try {
        const sqliteVss = await (new Function('m', 'return import(m)'))('sqlite-vss');
        sqliteVss.load(db);
        const row = db.prepare('SELECT vss_version() as v').get();
        vssLoaded = !!row?.v;
        if (vssLoaded)
            console.log(`[OK] sqlite-vss extension loaded${row?.v ? ` (v=${row.v})` : ''}`);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[WARN] sqlite-vss (JS loader) not available: ${msg}`);
    }
    // (Removed native fallback loader for sqlite-vss)
    // Basic PRAGMAs
    try {
        db.exec('PRAGMA foreign_keys = ON;');
    }
    catch { }
    DB = db;
    return db;
}
function createFundScema() {
    const db = DB;
    if (!db)
        return;
    console.log('creating fund table ');
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
}
function deleteFundsSchema() {
    const db = DB;
    if (!db)
        return;
    console.warn('[WARN] dropping and creating tables...');
    try {
        db.exec('DROP TABLE IF EXISTS funds_vec;');
    }
    catch { }
    try {
        db.exec('DROP TABLE IF EXISTS funds;');
    }
    catch { }
}
// Utility: clear all known tables if they exist
function clearAllData(db) {
    try {
        db.exec('DELETE FROM funds;');
        console.log('[OK] Cleared table: funds');
    }
    catch { }
    try {
        db.exec('DELETE FROM funds_vec;');
        console.log('[OK] Cleared table: funds_vss');
    }
    catch { }
}
//# sourceMappingURL=sqlite-connector.js.map