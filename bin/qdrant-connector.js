"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQdrantClient = getQdrantClient;
exports.ensureCollection = ensureCollection;
exports.dropAndCreateCollection = dropAndCreateCollection;
exports.upsertPoints = upsertPoints;
exports.searchPoints = searchPoints;
exports.scrollPoints = scrollPoints;
exports.deletePoints = deletePoints;
exports.countPoints = countPoints;
exports.retrievePoint = retrievePoint;
const js_client_rest_1 = require("@qdrant/js-client-rest");
const qdrant_runner_1 = require("./qdrant-runner");
let clientSingleton = null;
const URL_QDRANT = 'http://127.0.0.1:6333';
function getQdrantClient() {
    if (!clientSingleton) {
        const url = URL_QDRANT;
        void (0, qdrant_runner_1.ensureQdrantRunning)(url).catch(() => { });
        clientSingleton = new js_client_rest_1.QdrantClient({ url });
    }
    return clientSingleton;
}
async function ensureCollection(collection, dim = 768) {
    const client = getQdrantClient();
    try {
        await client.getCollection(collection);
        return;
    }
    catch {
        // fallthrough to create
    }
    await client.createCollection(collection, {
        vectors: { size: dim, distance: 'Cosine' },
    });
}
async function dropAndCreateCollection(collection, dim = 768) {
    const client = getQdrantClient();
    try {
        await client.deleteCollection(collection);
    }
    catch {
        // ignore if not exists
    }
    await client.createCollection(collection, {
        vectors: { size: dim, distance: 'Cosine' },
    });
}
async function upsertPoints(collection, points) {
    const client = getQdrantClient();
    await client.upsert(collection, { points });
}
async function searchPoints(collection, vector, limit, with_payload = true, filter) {
    const client = getQdrantClient();
    const params = { vector, limit, with_payload };
    if (filter) {
        params.filter = filter;
    }
    return client.search(collection, params);
}
async function scrollPoints(collection, params) {
    const client = getQdrantClient();
    return client.scroll(collection, params);
}
async function deletePoints(collection, ids) {
    const client = getQdrantClient();
    await client.delete(collection, { points: ids });
}
async function countPoints(collection, exact = true, filter) {
    const client = getQdrantClient();
    const params = { exact };
    if (filter) {
        params.filter = filter;
    }
    const res = await client.count(collection, params);
    return Number(res?.count ?? res?.result?.count ?? 0);
}
async function retrievePoint(collection, id, with_vector = true, with_payload = true) {
    const client = getQdrantClient();
    const res = await client.retrieve(collection, { ids: [id], with_vector, with_payload });
    const arr = res ?? [];
    return Array.isArray(arr) ? arr[0] : null;
}
//# sourceMappingURL=qdrant-connector.js.map