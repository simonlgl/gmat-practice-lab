# GMAT Practice Lab

Private GMAT-style practice website with profile login, adaptive drills,
full-section mock mode, local analytics, friend leaderboards, JSON import/export,
and optional AI question generation.

This is not an official GMAT or GMAC product. The built-in questions are original
practice items. Official GMAT resources are linked from the app but not copied.

## Run Locally

```bash
npm install
npm run dev
```

## Accounts And Friends

The app supports two modes:

- Cloud mode: Vercel Redis/KV stores profiles, sessions, friend relationships,
  attempts, streaks, and leaderboard data.
- Local fallback: if Redis/KV is not configured, profiles and friend snapshots
  stay in the current browser through IndexedDB.

For real cross-device login and live friend dashboards on Vercel, add a Vercel
Redis/KV store to the project and expose:

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

GitHub Pages alone cannot securely store passwords, shared friend data, or
OpenAI API keys.

## Optional AI Questions

Question Studio and AI Infinite Practice use a server-side key. Add a local
`.env` based on `.env.example`:

```bash
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-5.5
KV_REST_API_URL=your_vercel_redis_rest_url
KV_REST_API_TOKEN=your_vercel_redis_rest_token
```

Without `OPENAI_API_KEY`, the rest of the app still works and AI features show a
clear setup message. Do not put an OpenAI key directly in browser code.

## Data Storage

Profiles, scores, attempts, friend snapshots, imported questions, and approved
AI drafts are stored in this browser via IndexedDB. Use Library -> Export JSON
to create a backup or move the bank to another browser.

## GitHub Launch Notes

You can publish the source code on GitHub. For a public live app with AI and
shared accounts, deploy from GitHub to a server-capable host such as Cloudflare,
Vercel, Netlify Functions, or Supabase-backed hosting. Static GitHub Pages is
fine for a local-only demo, but not for secure login, shared friends, or hidden
OpenAI keys.

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
```

The default scripts target Vercel/standard Next.js hosting. The original
Cloudflare Sites build is still available through `npm run build:sites`.
