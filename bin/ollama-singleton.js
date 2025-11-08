"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOllama = getOllama;
exports.getEmbeddingModel = getEmbeddingModel;
const ollama_1 = require("ollama");
// Single Ollama instance for the whole app
let instance = null;
// Embedding model configured at Ollama creation time
const EMBEDDING_MODEL = 'nomic-embed-text';
function getOllama() {
    if (!instance) {
        instance = new ollama_1.Ollama();
    }
    return instance;
}
function getEmbeddingModel() {
    return EMBEDDING_MODEL;
}
//# sourceMappingURL=ollama-singleton.js.map