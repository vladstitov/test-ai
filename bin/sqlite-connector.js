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
// - Loads sqlite-vec (required) and tries sqlite-vss (optional)
// - Ensures the 'funds' table exists
async function connectDB(dbPath = 'database.db') {
    console.log(`[INFO] Connecting to SQLite database: ${dbPath}`);
    const db = new better_sqlite3_1.default(dbPath);
    // Require sqlite-vec extension; abort if unavailable
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
        throw new Error(`[FATAL] sqlite-vec extension is required for embeddings: ${msg}`);
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
        console.warn(`[WARN] sqlite-vss extension not available; vector search disabled: ${msg}`);
    }
    // Basic PRAGMAs
    try {
        db.exec('PRAGMA foreign_keys = ON;');
    }
    catch { }
    // Ensure 'funds' table exists
    const fundsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='funds'").get();
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
            }
            catch (e) {
                console.warn('[WARN] Could not create funds_vss:', e.message);
            }
        }
    }
    else {
        console.log('[OK] Funds table present');
        try {
            const cols = db.prepare('PRAGMA table_info(funds)').all();
            // Ensure 'manager' column exists; add it if missing
            const hasManager = cols.some(c => c.name === 'manager');
            if (!hasManager) {
                console.log("[INFO] Adding 'manager' column to funds table as TEXT...");
                try {
                    db.exec('ALTER TABLE funds ADD COLUMN manager TEXT;');
                    console.log('[OK] manager column added');
                }
                catch (e) {
                    console.warn('[WARN] Could not add manager column:', e.message);
                }
            }
            // Migrate created_at -> createdAt if needed
            const hasCreatedAtSnake = cols.some(c => c.name === 'created_at');
            const hasCreatedAtCamel = cols.some(c => c.name === 'createdAt');
            if (hasCreatedAtSnake && !hasCreatedAtCamel) {
                console.log("[INFO] Renaming column 'created_at' to 'createdAt'...");
                try {
                    db.exec('ALTER TABLE funds RENAME COLUMN created_at TO createdAt;');
                    console.log('[OK] Column renamed to createdAt');
                }
                catch (e) {
                    console.warn('[WARN] Could not rename created_at -> createdAt automatically:', e.message);
                }
            }
            // Ensure VSS virtual table exists if vss is loaded
            if (vssLoaded) {
                try {
                    const vtab = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='funds_vss'").get();
                    if (!vtab) {
                        console.log('[INFO] Creating funds_vss virtual table...');
                        db.exec(`CREATE VIRTUAL TABLE funds_vss USING vss0(embedding(768));`);
                        console.log('[OK] funds_vss created');
                    }
                }
                catch (e) {
                    console.warn('[WARN] Could not ensure funds_vss table:', e.message);
                }
            }
        }
        catch (err) {
            console.log('[WARN] Could not verify/alter funds table:', err.message);
        }
    }
    return db;
}
//# sourceMappingURL=sqlite-connector.js.map