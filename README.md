# QuantumTrade

**AI-powered trading intelligence for serious traders.**

QuantumTrade combines live market data, World Bank macro indicators, and a multi-agent AI debate engine to deliver precise, actionable trading calls. Three frontier language models reason independently, then a portfolio-manager AI synthesizes their consensus into a single verdict with confidence, thesis, and action steps.

---

## Table of Contents

- [What is QuantumTrade?](#what-is-quantumtrade)
- [Core Features](#core-features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Authentication](#authentication)
- [Deployment](#deployment)
- [License](#license)

---

## What is QuantumTrade?

Most trading apps give you a chart and a price. QuantumTrade gives you **context, consensus, and conviction**:

- **Live market data** pulled from public endpoints (Stooq CSV) for quotes and daily/weekly/monthly history.
- **Macro context** from the World Bank API — GDP growth, inflation, unemployment, and real interest rates.
- **3-agent AI debate** using Gemini 3 Flash, GPT-5, and Gemini 2.5 Pro.
- **Synthesized verdict** from a fourth judge model that resolves disagreements and produces a concrete action plan.
- **Personal tools** for authenticated users: watchlists, portfolio tracking, price alerts, and saved analysis history.

---

## Core Features

| Feature | Description |
|--------|-------------|
| **Live Stock Terminal** | Search any ticker, view real-time quotes, and render interactive candle/area charts. |
| **Multi-Agent AI Debate** | Three specialized AI analysts argue the bull, bear, and contrarian cases independently. |
| **Judge Synthesizer** | A senior portfolio-manager AI weighs the agents and returns a unified `BUY` / `HOLD` / `SELL` call. |
| **World Bank Macro Signals** | GDP growth, inflation, unemployment, and interest rates for the selected country. |
| **Watchlist** | Save tickers you follow and track them from the dashboard. |
| **Portfolio Tracker** | Log your holdings, average cost, and monitor position value against live quotes. |
| **Price Alerts** | Set `above` / `below` price targets and let the system flag them. |
| **Saved Analyses** | Revisit past AI debates and compare how the thesis evolved over time. |
| **Auth + RLS** | Email/password and Google sign-in with Supabase Row-Level Security protecting every user record. |

---

## How It Works

### 1. Data Layer

When a user searches a ticker, the backend fetches:

- A **latest quote** from Stooq (`open`, `high`, `low`, `close`, `volume`, `change %`).
- Up to **1 year of daily history** from the same source for charting and technical context.
- **World Bank macro indicators** for the selected country (default `USA`).

All external data is fetched inside `createServerFn` handlers so API keys and rate-limiting logic stay on the server.

### 2. The AI Debate

Three agents are prompted in parallel with the same market context:

| Agent | Model | Role |
|-------|-------|------|
| **Fast Analyst** | `google/gemini-3-flash-preview` | Decisive, recent price-action and technicals. |
| **Fundamental & Macro** | `openai/gpt-5` | Valuation, earnings quality, sector, and macro backdrop. |
| **Deep Reasoner** | `google/gemini-2.5-pro` | Contrarian, stress-test risks, non-obvious angles. |

Each agent returns structured JSON:

```json
{
  "recommendation": "BUY" | "HOLD" | "SELL",
  "confidence": 0-100,
  "thesis": "one paragraph",
  "bullets": ["max 4 short bullet points"]
}
```

### 3. The Verdict

A fourth **judge** (`google/gemini-2.5-pro`) reads all three replies, identifies where they agree and disagree, and outputs a final, precise call:

```json
{
  "recommendation": "BUY" | "HOLD" | "SELL",
  "confidence": 0-100,
  "summary": "2-3 sentence executive summary",
  "agreements": ["points all/most agree on"],
  "disagreements": ["key conflicts"],
  "action_plan": ["3-5 concrete next steps for the trader"]
}
```

This structure is rendered in the `AgentDebate` UI so users can see not just the answer, but the reasoning behind it.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [TanStack Start](https://tanstack.com/start/) v1 + React 19 + Vite 8 |
| **Styling** | Tailwind CSS v4 + native CSS variables (custom dark trading-floor theme) |
| **UI Components** | shadcn/ui primitives (`Button`, `Card`, `Tabs`, `Dialog`, `Input`, `Form`, etc.) |
| **Charts** | Recharts |
| **Backend** | `createServerFn` RPCs + Lovable Cloud / Supabase |
| **Database** | Supabase Postgres with Row-Level Security |
| **Auth** | Supabase Auth (email/password + Google OAuth) via `@lovable.dev/cloud-auth-js` |
| **AI Gateway** | Lovable AI Gateway (`ai` SDK + `@ai-sdk/openai-compatible`) |
| **Validation** | Zod |
| **Data Sources** | Stooq (market), World Bank API (macro) |

---

## Project Structure

```text
.
├── public/                    # Static assets
├── src/
│   ├── assets/                # Hero image, icons, etc.
│   ├── components/            # UI components (shadcn + custom)
│   │   ├── agent-debate.tsx   # Renders AI debate + verdict
│   │   ├── app-nav.tsx        # Authenticated app navigation
│   │   ├── stock-chart.tsx    # Recharts price chart
│   │   └── ui/                # shadcn/ui primitives
│   ├── integrations/
│   │   ├── lovable/           # Lovable AI helpers
│   │   └── supabase/          # Supabase clients, auth middleware, types
│   ├── lib/
│   │   ├── agents.functions.ts    # Multi-agent AI debate logic
│   │   ├── ai-gateway.server.ts   # Lovable AI Gateway provider
│   │   ├── data.functions.ts      # Watchlist, portfolio, alerts, analyses
│   │   ├── stocks.functions.ts    # Market + World Bank data fetching
│   │   └── utils.ts               # cn() and helpers
│   ├── routes/                    # TanStack file-based routes
│   │   ├── __root.tsx             # Root layout, meta, providers
│   │   ├── index.tsx              # Landing page
│   │   ├── auth.tsx               # Sign in / sign up
│   │   └── _authenticated/        # Protected routes
│   │       ├── dashboard.tsx          # Market terminal + watchlist
│   │       ├── stock.$symbol.tsx      # Per-stock analysis + chart
│   │       ├── portfolio.tsx          # Portfolio tracker
│   │       ├── watchlist.tsx          # Watchlist management
│   │       ├── alerts.tsx             # Price alerts
│   │       └── route.tsx              # Auth guard layout
│   ├── router.tsx             # TanStack Router setup
│   ├── start.ts               # TanStack Start server config
│   └── styles.css             # Tailwind v4 + theme tokens
├── supabase/
│   ├── migrations/            # SQL migrations (tables, RLS, policies)
│   └── config.toml            # Supabase config
├── .env                       # Environment variables
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 20+
- A Lovable Cloud project with Supabase enabled
- A Lovable AI Gateway key

### 1. Clone & Install

```bash
bun install
```

### 2. Configure Environment Variables

Copy or edit `.env` with your project values:

```bash
# Supabase (public, safe for browser)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id

# Supabase (server only)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_PROJECT_ID=your-project-id

# AI Gateway (server only)
LOVABLE_API_KEY=your-lovable-ai-gateway-key
```

> **Note:** `LOVABLE_API_KEY` is read inside server functions only and never exposed to the browser.

### 3. Run the Database Migrations

Apply the migrations in `supabase/migrations/` to create the required tables, indexes, and RLS policies.

### 4. Start the Dev Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Browser-facing Supabase project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Browser-facing Supabase anon key. |
| `VITE_SUPABASE_PROJECT_ID` | Yes | Supabase project ID for the auth helper. |
| `SUPABASE_URL` | Yes | Server-side Supabase URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Server-side Supabase anon key. |
| `SUPABASE_PROJECT_ID` | Yes | Server-side Supabase project ID. |
| `LOVABLE_API_KEY` | Yes | Lovable AI Gateway key for LLM calls. |

---

## Database Schema

All user-facing tables live in the `public` schema and have Row-Level Security enabled. Users can only read or modify their own rows.

| Table | Purpose |
|-------|---------|
| `profiles` | Public user profile (name, avatar, role) created via auth trigger. |
| `watchlist` | Ticker symbols a user follows, with optional notes. |
| `portfolio` | Holdings: ticker, shares, average cost. |
| `price_alerts` | `above` / `below` price targets per ticker. |
| `analyses` | Saved JSON results from AI debates. |

Key security rules:

- Every table has `ENABLE ROW LEVEL SECURITY`.
- All `SELECT/INSERT/UPDATE/DELETE` grants are scoped to `authenticated` users (and `service_role` for edge/admin use).
- Policies restrict operations to `auth.uid() = user_id`.

---

## Authentication

QuantumTrade uses Supabase Auth managed by Lovable Cloud:

- **Email / Password** — standard sign-up and sign-in flow.
- **Google OAuth** — configured via Supabase social provider.

Protected routes live under `/_authenticated/` and use a route guard that redirects anonymous visitors to `/auth`. Server functions that touch user data require `requireSupabaseAuth` middleware, which attaches the user's Supabase client to the function context.

---

## Deployment

This project is built for the Lovable Cloud / edge runtime:

```bash
bun run build
```

The build outputs a serverless bundle compatible with the Lovable Cloud deployment target. The preview server is started with:

```bash
bun run preview
```

For production, ensure all environment variables are set in your hosting dashboard and that the latest Supabase migrations have been applied.

---

## License

MIT — built for educational and research purposes. Trading decisions are your own responsibility; QuantumTrade does not provide financial advice.

---

<p align="center">
  <strong>Three AI analysts. One precise verdict.</strong><br>
  <a href="/">Launch the terminal →</a>
</p>
