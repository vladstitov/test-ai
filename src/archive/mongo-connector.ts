type AnyDoc = Record<string, any>;
import { MongoClient } from 'mongodb';
import type { IOFundModel } from '../fund.types';

interface ImportOptions {
  mongoUri?: string; host?: string; port?: string | number; user?: string; pass?: string; db?: string; params?: string;
}

function defaultOptions(): ImportOptions {
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

var mongoClient: MongoClient

export async function ConnectToMongo() {
  return new Promise<MongoClient>(async (resolve, reject) => {

    const o = defaultOptions();
    buildUri(o);
    const uri = buildUri(o);
    //  const dbName = o.db || (new URL(uri).pathname.replace(/^\//,'') || undefined);
    // if (!dbName) throw new Error('Database name not specified.');
    const MongoClient = await loadMongoClient();
    mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 7000 })
    mongoClient.on('open', () => {
      console.log('[INFO] MongoDB connection opened.');
      resolve(mongoClient);
    });
    mongoClient.on('close', () => {
      console.log('[INFO] MongoDB connection closed.');
    });

    mongoClient.connect();

  })


}
function buildUri(o: ImportOptions): string {
  if (o.mongoUri) return o.mongoUri;
  const host = o.host || '127.0.0.1'; const port = String(o.port || 27017);
  const user = o.user ? encodeURIComponent(o.user) : ''; const pass = o.pass ? encodeURIComponent(o.pass) : '';
  const auth = (user || pass) ? `${user}${pass ? `:${pass}` : ''}@` : '';
  // const db =  '';
  const params = o.params ? `?${o.params}` : '';
  return `mongodb://${auth}${host}:${port}/${params}`;
}

async function loadMongoClient(): Promise<any> {
  try { const mod = await import('mongodb'); return mod.MongoClient; }
  catch { throw new Error('Missing dependency: mongodb. Install with: npm i mongodb'); }
}

export async function getFunds(offset: number = 0, limit: number = 100): Promise<IOFundModel[]> {
  const o = defaultOptions();
  const uri = buildUri(o);
  ;
  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 100;
  try {

    const projection = {
      _id: 1,
      name: 1,
      names: 1,
      fundType: 1,
     // manager: 1,
      vintage: 1,
      strategy: 1,
      geography: 1,
      strategyGroup: 1,
      geographyGroup: 1,
      fundSize: 1,
      targetSize: 1,
      status: 1,
      industries: 1
    } as const;
    const cursor = mongoClient.db('secondary')
      .collection('funds')
      .find({}, { projection })
      .skip(safeOffset)
      .limit(safeLimit);
    const docs = await cursor.toArray();
    return docs as unknown as IOFundModel[];
  } catch (err) {
    console.error('[ERROR] Failed to fetch funds from MongoDB:', (err as Error).message);
    return [];
    //try { await client.close(); } catch {}
  }
}

export async function getPrices(offset: number = 0, limit: number = 100): Promise<AnyDoc[]> {
  const o = defaultOptions();
  const uri = buildUri(o);
  const dbName = o.db || (new URL(uri).pathname.replace(/^\//, '') || undefined);
  if (!dbName) throw new Error('Database name not specified.');
  const MongoClient = await loadMongoClient();
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 7000 });
  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 100;
  try {
    await client.connect();
    const cursor = client.db(dbName).collection('prices').find({}).skip(safeOffset).limit(safeLimit);
    const docs = await cursor.toArray();
    return docs as AnyDoc[];
  } finally {
    try { await client.close(); } catch { }
  }
}
