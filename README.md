# Amour & Co. — Wedding Planner

Production-ready React + TypeScript + Tailwind CSS wedding planning app with a romantic editorial design system inspired by the supplied prototype.

## Tech Stack

- React + TypeScript (Vite)
- Tailwind CSS
- Lucide React icons
- MongoDB (state + assistant memory)
- Express backend for secure LLM provider calls (Gemini / OpenRouter)
- Dashboard-first wedding planner with floating AI chat button

## Run

```bash
npm install
npm run dev:full
```

Open `http://localhost:5173`.

## Build & Lint

```bash
npm run lint
npm run build
```

## Architecture

- `src/types/wedding.ts` — all shared domain models
- `src/data/mockWeddingData.ts` — minimal clean starter state (no seeded planner entries)
- `src/context/WeddingContext.tsx` — state, actions, metrics, and MongoDB sync
- `src/components/WeddingAssistantPanel.tsx` — floating AI chat widget + session history
- `src/ai/weddingAssistantEngine.ts` — provider-agnostic request flow + session-aware history fetch
- `server/index.js` — Mongo-backed planner API + agentic LLM orchestration

## Design Tokens

Configured in:

- `tailwind.config.ts`
- `src/index.css`

Includes the requested palette (`ivory-bg`, `blush-deep`, `champagne`, `sage`, etc.), typography (`Cormorant Garamond`, `Plus Jakarta Sans`), warm borders/shadows, and motion details.

## AI Wedding Assistant

The app opens on the planner dashboard (Overview, Budget, Timeline, Directory).  
Use the bottom-right floating **Chat with AI** button to open the assistant in a full-screen workspace.  
Use **Close chat** to return to the dashboard.  
All conversations are processed through the configured provider in real time using your live planner state.

- add expense 25000 for photographer advance
- add todo call caterer tomorrow
- add vendor Lens Studio as Photographer
- get me details of photographer
- show upcoming payments / budget summary

### LLM provider setup (secure key handling)

The assistant uses backend-only provider calls through `/api/assistant/reply`, so API keys are never exposed to the browser bundle.

1. Copy `.env.example` to `.env` and set your values:

```bash
AI_PROVIDER=openrouter
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.8-flash-lite
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=baidu/ernie-5.5-flash-preview:free
OPENROUTER_HTTP_REFERER=http://localhost:5173
OPENROUTER_X_TITLE=Wedding Planner AI
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=wedding_planner
MONGODB_PLANNER_COLLECTION=planner_state
MONGODB_ASSISTANT_COLLECTION=assistant_sessions
ASSISTANT_CONTEXT_WINDOW=18
ASSISTANT_PROVIDER_MAX_RETRIES=2
PORT=4000
```

2. Start full stack:

```bash
npm run dev:full
```

No local fallback mode is used for assistant responses. If the configured provider is unavailable, the chat reports the backend error explicitly.

### Troubleshooting 502 / proxy errors

If the browser shows Vite proxy errors (`502`, `ECONNRESET`, `ECONNREFUSED`) for `/api/*`:

- Ensure the API is running on `http://localhost:4000` (`npm run server`).
- If MongoDB Atlas TLS fails, DB-backed endpoints return `503` with an explicit message.
- For Atlas TLS issues:
  - Prefer Node 22 LTS.
  - Verify Atlas Network Access allowlist includes your current IP.
  - Check VPN/proxy/SSL inspection rules that may break TLS to `*.mongodb.net:27017`.

## Agentic AI Approach (Mongo + Provider Tools)

The backend now follows a deterministic agent loop:

1. Load latest planner state from MongoDB.
2. Load recent session memory (conversation turns) from MongoDB.
3. Prompt the configured provider (Gemini/OpenRouter) with:
   - current planner state
   - recent conversation context
   - strict tool/action schema
4. Parse model JSON response (`reply` + `actions`).
5. Validate and execute actions server-side (add expense/todo/vendor, mark paid).
6. Persist updated planner state and conversation memory back to MongoDB.
7. Return the reply + updated state to the UI.

This keeps the model generative, while keeping mutations deterministic and auditable on the server.

### Action tool routing (payments and follow-ups)

The assistant prompt includes explicit tool selection policy so mutations map reliably:

- `addExpense` for new payment/expense/advance entries
- `addTodo` for follow-ups, reminders, and checklist tasks
- `addVendor` for vendor contact/contract capture
- `markExpensePaid` for settling an existing expense

The server also normalizes common action aliases (for example, `addTask` -> `addTodo`, `markPaid` -> `markExpensePaid`) before execution.
For transient provider spikes, the backend retries model calls with bounded exponential backoff.
