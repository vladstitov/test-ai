# SQLite with VSS (Vector Similarity Search) - Node.js

This project demonstrates Vector Similarity Search (VSS) with SQLite in Node.js. It stores embeddings directly in the `documents` table and can leverage the `sqlite-vec` extension for native vector distance functions. A JavaScript fallback is used when the extension is unavailable. Optional offline chat is supported via Ollama.

## Features

- SQLite database with vector similarity search (sqlite-vec when available)
- Cosine similarity and Euclidean distance algorithms
- Embeddings stored on `documents.embedding` (BLOB with VSS, JSON fallback)
- CRUD operations and search APIs
- Hybrid search (text + semantic)
- Optional offline LLM chat via Ollama

## Prerequisites

- Node.js 16+
- npm or yarn
- For offline chat: Ollama running locally (`ollama serve`) and models pulled

## Installation

```bash
npm install
```

## Quick Start

```bash
# Build TypeScript
npm run build

# Run the main demo (inserts a sample doc and prints stats)
npm start

# Run test/demo flow (loads dummy data if DB is empty, runs searches)
npm test

# Simple console chat (requires Ollama)
npm run chat

# Offline chat / API demos (require Ollama)
npm run offline-chat
npm run api-demo
```

## Dummy Data

`dummy-data.json` includes 15 sample documents with categories and tags. When the database is empty, `npm test` inserts these documents and demonstrates search APIs.

### Dummy Data Highlights
- 15 documents across multiple categories (AI/ML, Database, Web, etc.)
- Random 384-dim embeddings for demonstration (or real embeddings via Ollama when inserting through the repository)
- Tags and categories for filtering

## Basic Usage

```javascript
// After building, import compiled JS
const { connectDB } = require('./bin/create-db.js');
const { CrudRepository } = require('./bin/crud.repo.js');
const { EmbeddingsService } = require('./bin/embeddings.service.js');

async function example() {
  const db = connectDB();
  const embeddings = new EmbeddingsService('nomic-embed-text');
  const repo = new CrudRepository(db, embeddings);

  // Insert a document (embedding generated automatically)
  const docId = await repo.insertDocument(
    'Sample Document',
    'This is sample content.'
  );

  // Search for similar documents (provide a query embedding)
  const queryEmbedding = await embeddings.generateQueryEmbedding('sample content');
  const results = new (require('./bin/search.repo.js').SearchRepository)(db)
    .searchSimilar(queryEmbedding, 5);

  console.log(results);
}

example().catch(console.error);
```

## Ollama Setup (for offline chat)

1. Install: https://ollama.ai
2. Start server: `ollama serve`
3. Pull models:
   - `ollama pull gemma3:4b`
   - `ollama pull nomic-embed-text`
4. Run: `npm run chat`, `npm run offline-chat`, or `npm run api-demo`

## Notes

- The project uses the `sqlite-vec` API (`vec_version`, `vec_distance_cosine`) when available.
- When `sqlite-vec` is not available, embeddings are stored as JSON strings and similarity is computed in JavaScript.
- Embeddings are stored in `documents.embedding` (BLOB if VSS, JSON otherwise). There is no separate `embeddings` table.

