# GuideRail — Claude Code Context

## Project Overview

**GuideRail** is a creator-to-learner transformation delivery SaaS. Creators build structured weekly programs (not courses); learners buy and complete them on a calm, drip-paced timeline. First-lane focus is fitness/movement programs (MVP).

Typical flow: Creator pastes YouTube links → AI suggests structure → Creator approves → Publishes with price → Learner buys → Completes weekly actions → Creator gets paid 90%.

---

## Monorepo Structure

```
apps/web/          # Next.js 15 app — primary application
packages/ai/       # Embeddings, clustering, LLM adapter, Gemini video analysis
packages/shared/   # Zod schemas, skin tokens, canonical types, YouTube utils
docs/              # Architecture & skin contract docs
docker-compose.yml # Local Postgres on port 5433
```

Package manager: **pnpm 9** (workspaces).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15.1 (App Router) + React 19 + TypeScript 5.6 |
| Database | PostgreSQL via Prisma 6.2 (Neon in prod, Docker locally) |
| Auth — Creators | Clerk (`@clerk/nextjs`) |
| Auth — Learners | Magic links (email-based, custom) |
| Payments | Stripe one-time payments + Stripe Connect Express (creator payouts) |
| File storage | Vercel Blob |
| Email | Resend API (falls back to console if no key) |
| AI — LLM | Anthropic Claude (`claude-sonnet-4-20250514`) or OpenAI GPT-4o |
| AI — Embeddings | HuggingFace `sentence-transformers/all-MiniLM-L6-v2` |
| AI — Video | Gemini 2.5 Flash |
| Styling | Tailwind CSS 3 + custom token-based skin system |
| Testing | Vitest 2 |

---

## Dev Commands

```bash
pnpm dev              # Start Next.js on localhost:3000
pnpm build            # prisma generate + next build
pnpm db:push          # Push Prisma schema to DB (no migration file)
pnpm db:generate      # Regenerate Prisma client only
pnpm test             # Run Vitest
docker-compose up -d  # Start local Postgres (port 5433)
```

---

## Key Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...        # Neon (prod) or localhost:5433 (local)
DIRECT_DATABASE_URL=postgresql://... # Used for migrations/direct connection

# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Payments
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# AI
LLM_PROVIDER=stub|anthropic|openai   # stub = no API calls, safe for local dev
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
HUGGINGFACEHUB_API_TOKEN=hf_...

# Email
RESEND_API_KEY=...                   # Optional — logs to console if absent
```

---

## Data Model (Key Models)

Schema: [apps/web/prisma/schema.prisma](apps/web/prisma/schema.prisma)

| Model | Purpose |
|---|---|
| `User` | Creators (clerkId) and learners (email). Same table, `role` field distinguishes. |
| `Program` | Creator-owned program. Has `stripeProductId`, `stripePriceId`, `skinId`, `pacingMode`. |
| `Week → Session → Action` | Hierarchical content. Actions are WATCH / READ / DO / REFLECT. |
| `Entitlement` | Purchase record. Tracks `currentWeek`, `status` (ACTIVE/REVOKED/EXPIRED). Unique on `(userId, programId)`. |
| `LearnerProgress` | Per-action completion + reflection text. |
| `MagicLink` | Short-lived learner auth tokens. |
| `ProgramArtifact` | PDF/DOCX uploads — metadata + extracted text stored in DB. |
| `GenerationJob` / `ProgramDraft` | Async AI generation pipeline state. |
| `Embedding` / `ClusterAssignment` | HF vector embeddings + k-means cluster results. |

---

## Payment Flow

- **Platform fee:** 10% (hardcoded `PLATFORM_FEE_PERCENT` in checkout route)
- **Creator payout:** 90% via Stripe Connect **destination charges** — automatic transfer to creator's connected account
- **Checkout:** `POST /api/checkout/[programId]` creates a Stripe Checkout Session
- **Webhook:** `POST /api/webhooks/stripe` handles `checkout.session.completed` → upserts `Entitlement` (ACTIVE), sends magic link email to learner
- **Publish gate:** Paid programs require `stripeOnboardingComplete = true` on the creator's `User` record
- **Free programs** (`priceInCents = 0`) bypass Stripe entirely — immediate access granted

Edge case: if a creator somehow lacks a Stripe Connect account at checkout time, funds go 100% to the platform (logged as a warning, not blocked).

---

## Auth Flow

**Creators** → Clerk JWT. Middleware at [apps/web/middleware.ts](apps/web/middleware.ts) protects `/dashboard`, `/programs/*`, `/onboarding`, `/new`.

**Learners** → Magic links. On checkout, a `MagicLink` token is emailed. `GET /auth/magic?token=...` verifies it and sets a session cookie. Learner `User` records are auto-created on first checkout (email-based identity).

---

## Skin / Theme System

- 4 built-in skins: `default`, `professional`, `warm`, `minimal`
- Token types defined in [packages/shared/src/skin-tokens.ts](packages/shared/src/skin-tokens.ts)
- Full spec in [docs/SKIN-CONTRACT.md](docs/SKIN-CONTRACT.md)
- Runtime CSS variable injection via [apps/web/lib/skin-bridge.ts](apps/web/lib/skin-bridge.ts)
- Both modern (`--token-*`) and legacy (`--skin-*`) CSS variables are emitted for compatibility
- Token categories: `color`, `text`, `radius`, `shadow`, `component`

---

## AI Pipeline

1. Creator pastes YouTube video URLs
2. HuggingFace generates embeddings from video metadata/transcripts ([packages/ai/src/hf-embeddings.ts](packages/ai/src/hf-embeddings.ts))
3. K-means clustering groups related videos ([packages/ai/src/clustering.ts](packages/ai/src/clustering.ts))
4. LLM generates a structured program draft (weeks/sessions/actions) ([packages/ai/src/llm-adapter.ts](packages/ai/src/llm-adapter.ts))
5. Gemini 2.5 Flash analyzes individual videos for transcripts, key moments, topics ([packages/ai/src/gemini-video-analyzer.ts](packages/ai/src/gemini-video-analyzer.ts))
6. Creator reviews the `ProgramDraft` and approves or edits before publishing

Use `LLM_PROVIDER=stub` locally to skip all LLM API calls.

---

## Deployment

- Target: **Vercel** — root directory must be set to `apps/web` in Vercel project settings
- Config: [apps/web/vercel.json](apps/web/vercel.json)
- Build runs `prisma migrate deploy` before `next build`
- Remote image domains: `i.ytimg.com`, `img.youtube.com` (YouTube thumbnails)

---

## Key File Locations

| Purpose | Path |
|---|---|
| Prisma schema | [apps/web/prisma/schema.prisma](apps/web/prisma/schema.prisma) |
| Stripe checkout | [apps/web/app/api/checkout/[programId]/route.ts](apps/web/app/api/checkout/[programId]/route.ts) |
| Stripe webhook | [apps/web/app/api/webhooks/stripe/route.ts](apps/web/app/api/webhooks/stripe/route.ts) |
| Stripe Connect onboarding | [apps/web/app/api/stripe/connect/route.ts](apps/web/app/api/stripe/connect/route.ts) |
| Program publish (Stripe product creation) | [apps/web/app/api/programs/[id]/publish/route.ts](apps/web/app/api/programs/[id]/publish/route.ts) |
| Magic link utility | [apps/web/lib/magic-link.ts](apps/web/lib/magic-link.ts) |
| Skin bridge (CSS variable injection) | [apps/web/lib/skin-bridge.ts](apps/web/lib/skin-bridge.ts) |
| Skin token types | [packages/shared/src/skin-tokens.ts](packages/shared/src/skin-tokens.ts) |
| LLM adapter | [packages/ai/src/llm-adapter.ts](packages/ai/src/llm-adapter.ts) |
| Next.js config | [apps/web/next.config.ts](apps/web/next.config.ts) |
| Clerk middleware | [apps/web/middleware.ts](apps/web/middleware.ts) |
| Stripe client init | [apps/web/lib/stripe.ts](apps/web/lib/stripe.ts) |
