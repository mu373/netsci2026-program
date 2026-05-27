# NetSci 2026 Unofficial Guide

Unofficial guide for exploring the NetSci 2026 program: <https://netsci2026.minamiueda.com>. It supports calendar browsing, program search, people pages, saved items, related-item discovery, calendar export, and a chat interface backed by program data and LLM.

## Stack

- React 19, TypeScript, Vite
- Cloudflare Worker with Hono
- Program data generated into `src/data/program-data.json`
- Gemini Embeddings 2 for related items, topic clusters

## Setup

```sh
pnpm install
```

Enable the chat tab:

```sh
wrangler secret put GEMINI_API_KEY
```

Without a Gemini key, the chat tab is disabled and `/api/chat` returns unavailable.

Enable Google Analytics by copying the env template and setting the Vite build-time variable:

```sh
cp .env.example .env.production
```

If `VITE_GOOGLE_ANALYTICS_ID` is unset, the app does not load Google Analytics.

## Commands

```sh
pnpm dev             # Vite frontend
pnpm dev:worker      # Cloudflare Worker with static assets/API
pnpm build           # Type-check and build frontend
pnpm preview         # Preview built frontend
pnpm run deploy      # Build data, build app, deploy Worker
```

Use `pnpm run deploy`, not bare `pnpm deploy`; pnpm reserves `deploy` for its workspace deploy command.

## Data Pipeline

```sh
pnpm extract         # Fetch and extract official program data into data/
pnpm extract:cached  # Extract from local program.html
pnpm similarity      # Build embeddings and clusters
pnpm build:data      # Compile app-ready JSON into src/data/
```

`scripts/similarity.py` embeds talks, posters, and sessions, then derives related items, topic clusters, and people vectors. The default embedding model is `gemini-embedding-2-preview`; intermediate vectors and clusters live in `data/similarity-content/`.

Source data lives in `data/`. App-ready data lives in `src/data/` and is imported by both the frontend and Worker.

## API

The Worker serves the SPA and JSON endpoints:

- `GET /api/program`
- `GET /api/search?q=...`
- `GET /api/item/:kind/:id`
- `GET /api/topics`
- `GET /api/people`
- `POST /api/chat`

OpenAPI docs are available at `/docs` when the Worker is running.

## License

MIT
