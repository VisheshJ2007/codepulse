# CodePulse — Flow Diagrams

These Mermaid diagrams illustrate how the app works end-to-end: architecture, real-time sync, code execution via Judge0, and AI features (assistant and inline completion).

Tip: In VS Code, open this file and press Ctrl+Shift+V to preview. If Mermaid doesn’t render, install a Mermaid preview extension.

## Architecture overview

```mermaid
graph LR
  U[User] -->|Edits Code / Clicks Run| FE[Frontend (React + Monaco)]
  subgraph Browser
    FE
  end

  FE -- Socket.IO (WebSocket) --> BE[Backend (Express + Socket.IO)]
  FE -- REST (HTTP) --> BE

  subgraph Server
    BE
    DB[(MongoDB Atlas)]
  end

  BE <--> DB

  BE -- REST (HTTPS) --> J0[[Judge0 CE API]]

  BE -- OpenAI (if key) --> OA[(OpenAI API)]
  BE -- Ollama (fallback) --> OL[(Ollama Local Model)]

  classDef svc fill:#eef,stroke:#99f,stroke-width:1px;
  classDef ext fill:#ffe,stroke:#cc3,stroke-width:1px;
  class FE,BE,DB svc;
  class J0,OA,OL ext;
```

## Initial load and sync

```mermaid
sequenceDiagram
  autonumber
  participant U as User Browser
  participant FE as Frontend (React+Monaco)
  participant BE as Backend (Socket.IO+Express)
  participant DB as MongoDB

  U->>FE: Open app (load)
  FE->>BE: Socket.IO connect
  BE->>DB: Find latest Code doc
  DB-->>BE: { content }
  BE-->>FE: emit("code-update", content)
  FE->>FE: Set editor value to content (no echo)
```

## Real-time editing (autosave + broadcast)

```mermaid
sequenceDiagram
  autonumber
  participant FE1 as Frontend A
  participant BE as Backend
  participant DB as MongoDB
  participant FE2 as Frontend B

  FE1->>BE: emit("code-change", newContent)
  BE->>DB: upsert Code { content: newContent }
  DB-->>BE: ack
  BE-->>FE2: broadcast("code-update", newContent)
  FE2->>FE2: Apply newContent (suppress re-emit)
```

## Run code (Judge0 execution)

```mermaid
sequenceDiagram
  autonumber
  participant FE as Frontend
  participant BE as Backend
  participant J0 as Judge0 CE

  FE->>BE: POST /api/execute { language, code, stdin }
  BE->>J0: POST /submissions?wait=true (base64)
  J0-->>BE: { stdout | stderr | compile_output | message }
  BE-->>FE: 200 { output fields }
  FE->>FE: Render output (and "Fix with AI" if errors)
```

## Ask AI (Explain/Improve/Refactor/Tests/Docs)

```mermaid
sequenceDiagram
  autonumber
  participant FE as Frontend
  participant BE as Backend
  participant OA as OpenAI (if key)
  participant OL as Ollama (fallback)

  FE->>BE: POST /api/ai { prompt, code, persona }
  alt OPENAI_API_KEY present
    BE->>OA: ChatCompletion (system persona + user prompt)
    OA-->>BE: response text
  else No key
    BE->>OL: /api/generate (model: {{OLLAMA_MODEL}})
    OL-->>BE: response text
  end
  BE-->>FE: { provider, text }
  FE->>FE: Show assistant reply (apply manually if desired)
```

## Inline Suggest (tab-complete)

```mermaid
sequenceDiagram
  autonumber
  participant FE as Frontend
  participant BE as Backend
  participant OA as OpenAI (if key)
  participant OL as Ollama (fallback)

  FE->>BE: POST /api/ai/complete { code, cursorOffset }
  alt OPENAI_API_KEY present
    BE->>OA: Prompt for short next-token completion
    OA-->>BE: completion snippet
  else No key
    BE->>OL: /api/generate (short completion)
    OL-->>BE: completion snippet
  end
  BE-->>FE: { provider, completion }
  FE->>FE: Insert at cursor; emit("code-change")
```

## Fix with AI (from failed run)

```mermaid
sequenceDiagram
  autonumber
  participant FE as Frontend
  participant BE as Backend
  participant OA as OpenAI
  participant OL as Ollama

  FE->>FE: Detect compile/runtime error in output
  FE->>BE: POST /api/ai { prompt: "Fix the code given this error...", code, errorOutput }
  BE->>OA: or OL (as per availability)
  OA-->>BE: Suggested fix / patch
  BE-->>FE: AI suggestion
  FE->>FE: Apply suggestion to editor (optional) and emit("code-change")
```

---

Notes
- The backend uses Mongoose to upsert a single shared Code document for simplicity.
- Socket events: code-change (from editor) and code-update (from server to all others).
- Judge0 is the CE instance at https://ce.judge0.com with wait=true for synchronous results.
- AI provider selection is dynamic: OpenAI if OPENAI_API_KEY is set; otherwise Ollama at OLLAMA_URL with model OLLAMA_MODEL.
