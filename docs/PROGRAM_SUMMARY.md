# CodeSync – Program Summary

## High-level Overview

CodeSync is a Google Docs–style collaborative coding environment. Multiple users edit the same code in real time, see each other’s changes instantly, and can run code across several languages via the Judge0 execution API. The code is autosaved to MongoDB Atlas so it persists across refreshes and restarts. An optional AI assistant (OpenAI or local Ollama) can explain code, suggest fixes, generate tests/docs, and provide inline completions.

Core capabilities:
- Real‑time collaborative editing (Socket.IO)
- Persistent autosave to MongoDB Atlas
- Multi‑language code execution via Judge0 (Python, JS, Java, C/C++, etc.)
- User input (stdin) support for programs
- AI assistant panel (explain, improve, refactor, tests, docs) and inline suggest
- Language highlighting and modern editing via Monaco Editor


## High-level Design

The system is a client–server web app with a React frontend and Node/Express backend.

- Frontend (React)
  - Monaco Editor for rich code editing and syntax highlighting
  - Socket.IO client for real‑time code sync
  - Language selector, input (stdin) box, and output panel
  - AI Assistant panel (prompt chips, persona selector, provider indicator)
  - Inline Suggest: inserts AI code completion at the cursor
  - Clear Output action and “Fix with AI” when execution fails

- Backend (Node.js/Express)
  - Socket.IO server to broadcast code changes to all connected clients
  - MongoDB (Mongoose) for autosave/persistence of the shared code document
  - /api/execute endpoint proxies to Judge0 for compilation/execution
  - /api/ai endpoint routes prompts+code to OpenAI (if key set) or local Ollama
  - /api/ai/complete endpoint returns an inline code completion to insert in-editor

- Data store
  - MongoDB Atlas (cloud) holds a single shared code document (upserted on change)

- External services
  - Judge0 CE (default) or self‑hosted Judge0 for multi‑language execution
  - OpenAI (optional) or Ollama (local fallback) for AI features


## Architecture (at a glance)

- Client sends code changes → Socket.IO → Server broadcasts to all → All clients update editor state
- Client connects → Server loads latest code from MongoDB → Emits to client for initial state
- Run code → Frontend POST /api/execute (language, code, stdin) → Backend → Judge0 → Result (stdout/stderr) → Frontend output
- AI Assistant → Frontend POST /api/ai (prompt, code, language[, persona]) → Backend → Provider (OpenAI/Ollama) → Response text
- Inline Suggest → Frontend POST /api/ai/complete (code, cursor offset, language) → Provider → Completion text → Insert at cursor → Broadcast change


## Key Components & Responsibilities

- Frontend
  - `src/App.js`: Main UI, Monaco Editor, Socket.IO client wiring, run/AI actions
  - Real‑time UX: Sync indicator (Synced/Syncing…), Clear Output, Fix with AI, persona selector

- Backend
  - `server.js`:
    - Express app + Socket.IO server
    - Mongoose model for shared code `{ content: String }`
    - Endpoints: `/api/execute`, `/api/ai`, `/api/ai/complete`
    - Judge0 proxy and AI provider routing (OpenAI → if `OPENAI_API_KEY`; otherwise Ollama)


## Data Model (minimal)

- Collection: `code`
  - Single document (the shared buffer)
  - `{ content: string }`
  - Upserted on every `code-change` event


## Real-time Collaboration

- On connection, server queries MongoDB for the shared document and emits its content to the new client.
- On edit, the client emits `code-change`; server upserts the document and broadcasts the new content to all clients (including the origin) to keep everyone in sync.


## Code Execution Flow (Judge0)

- Frontend sends `{ language, code, input }` to `/api/execute`
- Backend maps language → Judge0 language_id, submits a synchronous request (`wait=true`), then fetches the result by token
- Result returns stdout, stderr, compile_output, status, timing, and memory
- Frontend combines these into the output panel; if there’s an error, a “Fix with AI” button appears


## AI Features

- Assistant panel
  - Prompt chips (Explain, Find bug, Improve, Refactor, Tests, Docs)
  - Persona modes (Default, Strict Reviewer, Speedy Pair, Teacher)
  - Uses the selected text (if any) or the entire buffer
  - Displays provider badge: OpenAI or Ollama

- Inline Suggest
  - Sends code prefix/suffix with cursor offset for focused completion
  - Inserts returned code directly at the cursor and syncs to collaborators

- Providers
  - OpenAI (Chat Completions) when `OPENAI_API_KEY` is set on the backend
  - Ollama fallback (no key) via local `http://localhost:11434` with configurable model (e.g., `llama3.1:8b`, `codellama:7b`)


## Configuration & Environment Variables

Backend (server):
- `PORT` – Express port (default 3001)
- `MONGODB_URI` – MongoDB Atlas connection string
- `OPENAI_API_KEY` – Optional; enables OpenAI provider
- `OLLAMA_URL` – Optional; default `http://localhost:11434/api/chat`
- `OLLAMA_MODEL` – Optional; default `llama3.1:8b`

Frontend (build-time, optional):
- Suggested: `REACT_APP_API_BASE`, `REACT_APP_SOCKET_URL` for deployment flexibility


## Use Cases

- Pair programming or classroom coding where participants need to:
  - Edit the same file together with instant updates
  - Run snippets in multiple languages during teaching or demos
  - Feed sample stdin to programs (e.g., competitive programming problems)
  - Ask an AI to explain code, propose fixes, generate tests/docs
  - Get inline code suggestions while typing


## Deployment Considerations

- Frontend: Deploy to Vercel/Netlify; parameterize API and Socket URLs via env vars
- Backend: Deploy to Railway/Render/Fly.io/VPS with WebSocket support; set CORS origins to your frontend domain
- Judge0: For reliability, self‑host with Docker or use a paid endpoint (replace URL/headers in the backend)
- MongoDB Atlas: Keep `0.0.0.0/0` only for development; lock down IPs/peering for production
- AI: Choose OpenAI/OpenRouter for hosted reliability, or host Ollama on the server (ensure sufficient RAM/CPU)
- Scale: For multi‑instance backends, use a Socket.IO adapter (Redis) to coordinate broadcasts across instances


## Local Development (quick start)

- Backend
  1. Set env vars (PowerShell example):
     - `MONGODB_URI` – your Atlas URI
     - Optional AI paths:
       - OpenAI: `$env:OPENAI_API_KEY="sk-..."`
       - Ollama: `$env:OLLAMA_MODEL="llama3.1:8b"` (after installing/pulling a model)
  2. `npm start`

- Frontend
  1. `npm start`
  2. Open `http://localhost:3000`


## Limitations & Next Steps

Current limitations:
- Single shared document (no rooms/multi-file support)
- No presence indicators or multi-cursor visualization yet
- Judge0 CE has rate limits; consider self-hosting for production

Potential next steps:
- Multi-file projects and rooms (per‑URL session IDs)
- Presence (avatars), cursor/selection sharing, and chat
- Save history/versions; add “Revert to previous”
- User auth and per‑user permissions
- Environment‑based frontend configuration for API/socket URLs
- Self-hosted Judge0 with queueing and caching

---
This document summarizes the purpose, design, and usage of CodeSync, including how collaboration, persistence, execution, and AI fit together and what to configure for local development and deployment.

## Diagrams

For visual flows of the architecture and key interactions (initial sync, real-time edits, Judge0 execution, AI assistant, and inline suggestions), see:

- docs/flow-diagrams.md
