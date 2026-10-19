# DuckBot OS

Local-first personal agent control center built on Hermes, LM Studio,
DuckBot RAG memory, and SystemOne typed decisions.

## What it is

DuckBot OS is a dashboard and control plane for your local AI stack. It
sits on top of Hermes (agent runtime), LM Studio (local inference),
DuckBot RAG memory, and SystemOne (typed decision layer) — giving you one
place to see what's happening, approve actions, and coordinate bots.

It is **not** a replacement for macOS or Hermes. It's the command layer
you actually use.

## What it gives you

| Section | Purpose |
|---|---|
| **Command Center** | One natural-language bar to ask DuckBot to inspect, plan, or coordinate |
| **DuckBot Brain** | Persistent RAG memory — what DuckBot remembers, decisions, evidence |
| **Agent Fleet** | Agent DuckBot + specialist bots (Ops, Research, Build) with roles and risk levels |
| **Model Router** | What's loaded in LM Studio (Nemotron 120B VL, etc.) + cloud models via Muse/OpenCode Zen |
| **System & Devices** | Mac mini health, local model server status, browser/Telegram/MCP health |
| **Automation Board** | Cron jobs, scheduled tasks, approvals for external/destructive actions |
| **Security Gate** | Read-only runs automatically; destructive/external actions need your approval |

## Running locally

```bash
cd duckbot-os
npm install          # or just node server.mjs (no deps beyond Node stdlib)
npm start
```

Then open:

- Local: `http://127.0.0.1:4177`
- Tailscale (from phone/other devices): `http://<your-tailscale-ip>:4177`

## SystemOne integration

DuckBotOS proxies typed decisions to the local [SystemOne](https://github.com/Franzferdinan51/SystemOne) shim.

The SystemOne shim runs on port 8765 and provides:

- `GET /healthz` — shim liveness + loaded model/backend
- `POST /v1/systemone/decide` — typed decision (`choice`, `score`, `noul`)
- `POST /v1/systemone/route` — model/router tier decision
- `POST /v1/systemone/batch` — bulk typed decisions

DuckBotOS exposes these through:

- `GET /api/overview` — system health including SystemOne shim status
- `POST /api/systemone/decide` — proxies to the SystemOne shim decide endpoint
- `POST /api/systemone/route` — proxies to the SystemOne shim route endpoint

Set `SYSTEMONE_SHIM_URL` if your shim is on a different host:

```bash
export SYSTEMONE_SHIM_URL=http://<windows-pc-tailscale-ip>:8765
npm start
```

If the shim isn't reachable, DuckBotOS reports SystemOne as `disconnected`
and continues in shadow-only mode — nothing breaks.

## Architecture

```
Natural language request
    ↓
DuckBot OS control plane (intent → policy → tools)
    ↓
Hermes agents + DuckBot RAG memory + SystemOne decisions
    ↓
Your files, apps, system, bots, models, and real-world actions
```

- **Hermes** — agent runtime and tool executor
- **DuckBot RAG memory** — durable local memory (ChromaDB + graph)
- **LM Studio** — your local inference engine
- **Muse / OpenCode Zen** — cloud model layer for heavier reasoning
- **SystemOne (Jeff-1 / decider-4b)** — local typed-decision layer for routing, scoring, triage

## Security

- Read-only inspection runs automatically
- Reversible changes require a plan first
- External messages, file deletion, SSH changes, financial actions, and infrastructure changes require your explicit approval
- No credentials or API keys are stored in this repo

## Repos

- DuckBot OS (this repo): https://github.com/Franzferdinan51/DuckBotSystem
- SystemOne: https://github.com/Franzferdinan51/SystemOne
