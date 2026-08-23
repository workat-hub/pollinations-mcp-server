# Pollinations Image MCP Server

A small MCP (Model Context Protocol) server exposing one tool, `generate_image`,
backed by [Pollinations.ai](https://pollinations.ai)'s image generation API.

## Important: Pollinations' API changed in 2026

Pollinations used to be fully free and keyless. As of 2026 it still serves
anonymous (no-key) requests, but under a tight per-IP rate limit
(roughly 1 image/hour without a key). For anything beyond occasional use,
get a free **publishable key** at https://enter.pollinations.ai (quick
sign-up, no credit card) and set it as the `POLLINATIONS_API_KEY`
environment variable on your host. The server works with or without it —
it just falls back to the anonymous rate limit if unset.

## Deploying on Render (free tier)

1. Push these three files to a GitHub repo (public or private).
2. In Render: **New > Web Service**, connect the repo.
3. Environment: `Node`. Build command: `npm install`. Start command: `npm start`.
4. (Optional) Add an environment variable `POLLINATIONS_API_KEY` with your key.
5. Deploy. Render gives you a URL like `https://your-service.onrender.com`.
   Your MCP endpoint is that URL plus `/mcp`.

Note: Render's free tier spins the instance down after 15 minutes of
inactivity, so the first request after a quiet period can take 30-60
seconds while it wakes up — that's expected, not a bug.

## Adding it to Claude

Settings → Connectors → Add → Custom → paste
`https://your-service.onrender.com/mcp`.

## Local test

```
npm install
npm start
# in another terminal:
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```
