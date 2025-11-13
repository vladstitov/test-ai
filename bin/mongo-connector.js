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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectToMongo = ConnectToMongo;
exports.getFunds = getFunds;
exports.getPrices = getPrices;
function defaultOptions() {
    const cfg = require('../../config.json');
    return {
        mongoUri: undefined,
        // Hardcoded defaults per request
        host: cfg.mongo.host,
        port: 27017,
        user: cfg.mongo.username || undefined,
        pass: cfg.mongo.password || undefined,
        db: 'secondary',
        params: undefined
    };
}
var mongoClient;
async function ConnectToMongo() {
    return new Promise(async (resolve, reject) => {
        const o = defaultOptions();
        buildUri(o);
        const uri = buildUri(o);
        //  const dbName = o.db || (new URL(uri).pathname.replace(/^\//,'') || undefined);
        // if (!dbName) throw new Error('Database name not specified.');
        const MongoClient = await loadMongoClient();
        mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 7000 });
        mongoClient.on('open', () => {
            console.log('[INFO] MongoDB connection opened.');
            resolve(mongoClient);
        });
        mongoClient.on('close', () => {
            console.log('[INFO] MongoDB connection closed.');
        });
        mongoClient.connect();
    });
}
function buildUri(o) {
    if (o.mongoUri)
        return o.mongoUri;
    const host = o.host || '127.0.0.1';
    const port = String(o.port || 27017);
    const user = o.user ? encodeURIComponent(o.user) : '';
    const pass = o.pass ? encodeURIComponent(o.pass) : '';
    const auth = (user || pass) ? `${user}${pass ? `:${pass}` : ''}@` : '';
    // const db =  '';
    const params = o.params ? `?${o.params}` : '';
    return `mongodb://${auth}${host}:${port}/${params}`;
}
async function loadMongoClient() {
    try {
        const mod = await Promise.resolve().then(() => __importStar(require('mongodb')));
        return mod.MongoClient;
    }
    catch {
        throw new Error('Missing dependency: mongodb. Install with: npm i mongodb');
    }
}
async function getFunds(offset = 0, limit = 100) {
    const o = defaultOptions();
    const uri = buildUri(o);
    ;
    const safeOffset = Math.max(0, Number(offset) || 0);
    const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 100;
    try {
        const projection = {
            _id: 1,
            name: 1,
            aliases: 1,
            fundType: 1,
            manager: 1,
            vintage: 1,
            strategy: 1,
            geography: 1,
            strategyGroup: 1,
            geographyGroup: 1,
            fundSize: 1,
            targetSize: 1,
            status: 1,
            industries: 1
        };
        const cursor = mongoClient.db('secondary')
            .collection('funds')
            .find({}, { projection })
            .skip(safeOffset)
            .limit(safeLimit);
        const docs = await cursor.toArray();
        return docs;
    }
    catch (err) {
        console.error('[ERROR] Failed to fetch funds from MongoDB:', err.message);
        return [];
        //try { await client.close(); } catch {}
    }
}
async function getPrices(offset = 0, limit = 100) {
    const o = defaultOptions();
    const uri = buildUri(o);
    const dbName = o.db || (new URL(uri).pathname.replace(/^\//, '') || undefined);
    if (!dbName)
        throw new Error('Database name not specified.');
    const MongoClient = await loadMongoClient();
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 7000 });
    const safeOffset = Math.max(0, Number(offset) || 0);
    const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 100;
    try {
        await client.connect();
        const cursor = client.db(dbName).collection('prices').find({}).skip(safeOffset).limit(safeLimit);
        const docs = await cursor.toArray();
        return docs;
    }
    finally {
        try {
            await client.close();
        }
        catch { }
    }
}
//# sourceMappingURL=mongo-connector.js.map