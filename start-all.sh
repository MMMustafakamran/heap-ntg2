#!/usr/bin/env bash
# HARNESS: starts every Antigravity-vue server on its harness ports (REPOS.md: never 3000/8000).
#   8141 own Antigravity quickstart agent (backend/main.py; React quickstart: 8000)
#   8140 runtime server.antigravity.ts (HttpAgent -> :8141); the Vue quickstart registers only a BuiltInAgent,
#        never an Antigravity agent (FINDINGS.md #9). Doc: 8200.
#   8155 Gemini key/model pool (tools/gemini_pool.py, OpenAI fallback) when GOOGLE_GEMINI_BASE_URL points at it
#   5140 Vite (doc: 5173)
# Override the agent URL with AGENT_URL. Key: backend/.env (see .env.example). The backend uses
# --env-file because the doc's .env is never loaded (Antigravity-react FINDINGS.md #1).
cd "$(dirname "$0")"
mkdir -p logs
# CHANGED: every server runs in a real terminal (.qa/tools/ptyrun.cjs): logs/<name>.log as before,
# plus logs/<name>.log.pty, the raw terminal the recorder shows on a failed take.
PTYRUN="node $(pwd)/.qa/tools/ptyrun.cjs"
: "${AGENT_URL:=http://localhost:8141}"

# HARNESS: Gemini pool on 8155 (copied from the google-adk repo). Keys: GEMINI_POOL_KEYS / GEMINI_POOL_KEYFILES, OpenAI as last-resort fallback;
# CI writes GOOGLE_GEMINI_BASE_URL=http://localhost:8155 into backend/.env so google-genai goes through it.
# --with httpx: the pool needs httpx, the doc's backend install doesn't have it.
(cd backend && PORT=8155 $PTYRUN ../logs/gemini-pool-8155.log --name "uv run python ../tools/gemini_pool.py" -- uv run --with httpx python ../tools/gemini_pool.py) &

# 1. agent backend
(cd backend && $PTYRUN ../logs/backend-8141.log --name "uv run uvicorn main:app --port 8141" -- uv run --env-file .env uvicorn main:app --port 8141) &
echo "waiting for the Antigravity backend on $AGENT_URL ..."
for _ in $(seq 1 60); do
  curl -sf "$AGENT_URL/health" > /dev/null 2>&1 && break
  sleep 2
done

# HARNESS: backends for the pages added 2026-11-10 (one port per page group).
(cd backend && $PTYRUN ../logs/backend-8142.log --name "uv run uvicorn main:app --port 8142" -- uv run --env-file .env uvicorn main:app --port 8142) &  # HARNESS: V1 quickstart-agent copy
(cd backend && $PTYRUN ../logs/backend-8143.log --name "uv run uvicorn v2_main:app --port 8143" -- uv run --env-file .env uvicorn v2_main:app --port 8143) &  # HARNESS: V2 tool/state rendering, mcp apps
(cd backend && $PTYRUN ../logs/backend-8144.log --name "uv run uvicorn shared_state_main:app --port 8144" -- uv run --env-file .env uvicorn shared_state_main:app --port 8144) &  # HARNESS: V3 shared-state pages
# HARNESS: V4 hitl/interrupt/subagents; --with httpx because subagents.py imports httpx and the doc's install never adds it (FINDINGS.md #47)
# HARNESS: the showcase _common.py (copied, never published) defaults to /data/ws, not writable on CI runners
mkdir -p backend/.antigravity-data/ws backend/.antigravity-data/sessions
(cd backend && ANTIGRAVITY_WORKSPACE="$PWD/.antigravity-data/ws" ANTIGRAVITY_SAVE_DIR="$PWD/.antigravity-data/sessions" $PTYRUN ../logs/backend-8145.log --name "uv run uvicorn v4_main:app --port 8145" -- uv run --with httpx --env-file .env uvicorn v4_main:app --port 8145) &

# 2. runtime, 3. Vite
cd my-copilot-app
(PORT=8146 $PTYRUN ../logs/runtime-8146.log --name "npx tsx server.v1.ts" -- npx tsx server.v1.ts) &  # HARNESS: V1 runtime
(PORT=8147 $PTYRUN ../logs/runtime-8147.log --name "npx tsx server.v2.ts" -- npx tsx server.v2.ts) &  # HARNESS: V2 runtime
(PORT=8148 $PTYRUN ../logs/runtime-8148.log --name "npx tsx server.v3.ts" -- npx tsx server.v3.ts) &  # HARNESS: V3 runtime
(PORT=8149 $PTYRUN ../logs/runtime-8149.log --name "npx tsx server.v4.ts" -- npx tsx server.v4.ts) &  # HARNESS: V4 runtime
(PORT=8154 $PTYRUN ../logs/runtime-8154.log --name "npx tsx server.threads.ts" -- npx tsx server.threads.ts) &  # HARNESS: Threads runtime with CopilotKitIntelligence (needs CPK_INTELLIGENCE_API_KEY: env, or my-copilot-app/.env.intelligence)
(PORT=8140 AGENT_URL="$AGENT_URL" $PTYRUN ../logs/runtime-8140.log --name "npx tsx server.antigravity.ts" -- npx tsx server.antigravity.ts) &
($PTYRUN ../logs/vite-5140.log --name "npm run dev" -- npm run dev) &
wait
