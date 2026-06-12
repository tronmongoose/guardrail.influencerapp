When working on marketing, copy, ads, or brand tasks, read JOURNEYLINEMARKETING.md first.
# JourneyLine.AI — Claude Code Context

## Project Overview

**JourneyLine.AI** is a creator-to-learner transformation delivery SaaS. Creators build structured programs (not courses); learners buy and complete them on a calm, paced timeline. First-lane focus is fitness/movement programs (MVP).

Typical flow: Creator pastes YouTube links → AI suggests structure → Creator approves → Pays a one-time $99 platform fee to publish → Learner buys → Completes actions → Creator keeps 100% of the learner payment.

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
| File storage | Vercel Blob (private store) |
| Video — Transcoding | Mux Video (`@mux/mux-node`) — HLS adaptive streaming |
| Video — Player | Mux Player (`@mux/mux-player-react`) via `next/dynamic` SSR-disabled |
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

# Video (Mux)
MUX_TOKEN_ID=...                     # Mux API access token ID
MUX_TOKEN_SECRET=...                 # Mux API access token secret
MUX_WEBHOOK_SECRET=...               # Mux webhook signing secret

# Email
RESEND_API_KEY=...                   # Required in prod — branded learner welcome + creator payout emails are silently dropped without it
EMAIL_FROM=...                       # Optional — full From string, defaults to "JourneyLine <noreply@journeyline.ai>"
EMAIL_FROM_ADDRESS=...               # Optional — bare address for branded "{creator} via JourneyLine <addr>" From line, defaults to noreply@journeyline.ai
ADMIN_NOTIFICATION_EMAIL=...         # Optional — receives admin enrollment + signup notifications
```

---

## Data Model (Key Models)

Schema: [apps/web/prisma/schema.prisma](apps/web/prisma/schema.prisma)

| Model | Purpose |
|---|---|
| `User` | Creators (clerkId) and learners (email). Same table, `role` field distinguishes. |
| `Program` | Creator-owned program. Has `stripeProductId`, `stripePriceId`, `skinId`, `pacingMode`, `videoGroups`, `sectionBoundaries`. |
| `Week → Session → Action` | Hierarchical content (DB model is `Week` but displayed as "Lesson" in UI). Actions are WATCH / READ / DO / REFLECT. |
| `Entitlement` | Purchase record. Tracks `currentWeek` (legacy name, represents current lesson), `status` (ACTIVE/REVOKED/EXPIRED). Unique on `(userId, programId)`. |
| `LearnerProgress` | Per-action completion + reflection text. |
| `MagicLink` | Short-lived learner auth tokens. |
| `ProgramArtifact` | PDF/DOCX uploads — metadata + extracted text stored in DB. |
| `GenerationJob` / `ProgramDraft` | Async AI generation pipeline state. |
| `Embedding` / `ClusterAssignment` | HF vector embeddings + k-means cluster results. |

---

## Payment Flow

JourneyLine's revenue model is a **flat $99 one-time fee per published program**. There is no revenue split on learner payments — creators keep 100% of what their audience pays them.

**Learner → Creator (program purchases)**
- **Checkout:** `POST /api/checkout/[programId]` creates a Stripe Checkout Session
- **Payout:** 100% of the learner payment transfers to the creator's connected account via Stripe Connect **destination charges** (no `application_fee_amount`)
- **Webhook:** `POST /api/webhooks/stripe` handles `checkout.session.completed` → upserts `Entitlement` (ACTIVE), sends magic link email to learner
- **Publish gate:** Paid programs require `stripeOnboardingComplete = true` on the creator's `User` record
- **Free programs** (`priceInCents = 0`) bypass Stripe entirely — immediate access granted

**Creator → JourneyLine (platform fee)**
- **Amount:** $99 one-time fee per creator account before publishing paid programs
- **Checkout:** [apps/web/app/api/checkout/platform/route.ts](apps/web/app/api/checkout/platform/route.ts) creates the Stripe Checkout Session
- **Webhook:** Same Stripe webhook (`type: "platform_access"` metadata) flips `User.platformPaymentComplete = true`
- **Publish gate:** `apps/web/app/api/programs/[id]/publish/route.ts` blocks publishing unless `User.platformPromoGranted || User.platformPaymentComplete`

Edge case: if a creator somehow lacks a Stripe Connect account at checkout time, funds go 100% to the platform (logged as a warning, not blocked).

---

## Auth Flow

**Creators** → Clerk JWT. Middleware at [apps/web/middleware.ts](apps/web/middleware.ts) protects `/dashboard`, `/programs/*`, `/onboarding`, `/new`.

**Learners** → Magic links. On checkout, a `MagicLink` token is emailed. `GET /auth/magic?token=...` verifies it and sets a session cookie. Learner `User` records are auto-created on first checkout (email-based identity).

---

## Skin / Theme System

- **50+ skin bundles** across 8 categories: `activity`, `classic`, `creative`, `entertainment`, `lifestyle`, `media`, `music`, `pro`
- Legacy skins (`default`, `professional`, `warm`, `minimal`) have been removed — all programs use the new catalog
- Token types defined in [packages/shared/src/skin-tokens.ts](packages/shared/src/skin-tokens.ts)
- Full spec in [docs/SKIN-CONTRACT.md](docs/SKIN-CONTRACT.md)
- Runtime CSS variable injection via [apps/web/lib/skin-bridge.ts](apps/web/lib/skin-bridge.ts)
- Both modern (`--token-*`) and legacy (`--skin-*`) CSS variables are emitted for compatibility
- Token categories: `color`, `text`, `radius`, `shadow`, `component`
- Optional `background.gradient` token emits `--token-color-bg-gradient` for learner page gradient backgrounds
- `SkinPicker` uses a two-panel layout (category tabs + skin grid) with hover-to-preview via `SkinPreviewPanel`
- `SkinPreviewPanel` renders a live mock learner page using CSS token vars; shows Learner step view and Program covers sections

---

## Mux Video Pipeline

Uploaded videos are transcoded by Mux into HLS for universal browser playback.

**Upload flow:**
1. Creator uploads video → browser sends file directly to Mux via direct upload URL
2. Server creates `YouTubeVideo` record with `muxUploadId` and sentinel URL `mux-upload://...`
3. Mux webhook `video.upload.asset_created` → writes `muxAssetId`
4. Mux webhook `video.asset.ready` → writes `muxPlaybackId`, `muxStatus: "ready"`, and real stream URL
5. Viewer renders `<MuxVideoPlayer playbackId={...} />`

**Key implementation details:**
- `MuxVideoPlayer` uses `next/dynamic` with `ssr: false` — Mux Player is a web component that fails during SSR
- The `video.asset.ready` webhook has a fallback: looks up by `muxUploadId` if `muxAssetId` lookup fails (handles event ordering races)
- `mux-upload://` videos are excluded from the AI generation pipeline (no accessible URL for Gemini/embeddings)
- The upload URL route uses the request's `Origin` header for CORS so it works on production, preview, and localhost
- Vercel Blob is still used for legacy uploads; Mux is the primary path for new uploads
- Backfill endpoint at `GET /api/mux/backfill` fixes records with missing/wrong playback IDs
- Debug endpoint at `GET /api/mux/debug?programId=xxx` shows all Mux fields for a program

**Key files:**
| Purpose | Path |
|---|---|
| Mux client init | [apps/web/lib/mux.ts](apps/web/lib/mux.ts) |
| Upload URL creation | [apps/web/app/api/mux/upload-url/route.ts](apps/web/app/api/mux/upload-url/route.ts) |
| Mux webhook handler | [apps/web/app/api/webhooks/mux/route.ts](apps/web/app/api/webhooks/mux/route.ts) |
| MuxVideoPlayer component | [apps/web/components/viewer/MuxVideoPlayer.tsx](apps/web/components/viewer/MuxVideoPlayer.tsx) |
| Backfill endpoint | [apps/web/app/api/mux/backfill/route.ts](apps/web/app/api/mux/backfill/route.ts) |

---

## AI Pipeline

1. Creator uploads videos via Mux direct upload (YouTube URL paste is legacy — no current creator path adds new YouTube URLs; the `YouTubeVideo` model name is a relic and now stores any uploaded video)
2. **Video segmentation** ([packages/ai/src/video-segmentation.ts](packages/ai/src/video-segmentation.ts)): long videos (>10 min) are split into virtual child records using Gemini topic timestamps — no physical file splitting
3. HuggingFace generates embeddings from video metadata/transcripts ([packages/ai/src/hf-embeddings.ts](packages/ai/src/hf-embeddings.ts))
4. K-means clustering groups related videos ([packages/ai/src/clustering.ts](packages/ai/src/clustering.ts))
5. LLM generates a structured program draft (lessons/sessions/actions) ([packages/ai/src/llm-adapter.ts](packages/ai/src/llm-adapter.ts))
6. Gemini analyzes individual videos for full topic extraction, segment boundaries, transcripts ([packages/ai/src/gemini-video-analyzer.ts](packages/ai/src/gemini-video-analyzer.ts)). Models are configurable via env vars; defaults live in [packages/ai/src/constants.ts](packages/ai/src/constants.ts) — currently `gemini-3.1-pro-preview` for video and `gemini-3-flash-preview` for text.
7. Async generation pipeline handles segmented videos as independent content pieces
8. Creator reviews the `ProgramDraft` and approves or edits before publishing

**Note:** `mux-upload://` videos are excluded from Gemini analysis and HF embeddings (no accessible content). They get stub digests so the LLM still references them in the program structure.

Use `LLM_PROVIDER=stub` locally to skip all LLM API calls.

---

## Program Creation Wizard

4-step wizard at `apps/web/components/wizard/`:

| Step | Label | Component | Notes |
|---|---|---|---|
| 1 | Basics | `StepBasics` | Title + target transformation only (description/outcome removed from UI but kept in data model) |
| 2 | Content | `StepContent` | YouTube URLs + file artifact uploads |
| 3 | Lessons flow | `StepDuration` | Program length presets + pacing mode (drip vs unlock-on-complete). Uses "Lesson" terminology throughout. |
| 4 | Theme | `StepReview` | `SkinPicker` as hero; `vibePrompt` + `skinId` saved on generation |

- Wizard state auto-persists to `localStorage` (artifacts' `extractedText` excluded to avoid quota issues)
- On final step, saves program details via `PATCH /api/programs/[id]`, then calls `POST /api/programs/[id]/generate-async`

---

## Program Editor

Tab-based editor (`ProgramBuilderSplit`) with four tabs:

- **Curriculum** — drag-and-drop lesson/session tree (`TreeNavigation`), single `DndContext` to avoid nested sensor interference, cross-group session moves, inline rename on click
- **Settings** — program metadata
- **Pricing** — price, promo codes
- **Preview** — live skin preview

Drag-and-drop notes:
- Lesson reordering uses a two-pass DB transaction to avoid unique constraint conflicts on `sortOrder` (DB model is still `Week`)
- Session moves send `weekId` to support cross-group (cross-lesson) moves
- UI uses "Lesson" terminology everywhere; the DB model remains `Week` for backwards compatibility

---

## Promo Codes

- Full CRUD API at `POST/GET/PATCH/DELETE /api/programs/[id]/promo-codes`
- Validate endpoint: `POST /api/promo-codes/validate`

---

## Deployment

- Target: **Vercel** — root directory must be set to `apps/web` in Vercel project settings
- Production domain: `app.journeyline.ai`
- Config: [apps/web/vercel.json](apps/web/vercel.json)
- Build runs `prisma migrate deploy` before `next build`
- Remote image domains: `i.ytimg.com`, `img.youtube.com` (YouTube thumbnails)
- Prisma uses `directUrl` for migrations (Neon direct/non-pooled connection) and `url` for runtime queries (pooled)
- Vercel Blob store is **private** — all uploads use `access: "private"`
- Mux webhook URL: `https://app.journeyline.ai/api/webhooks/mux` (configured in Mux dashboard)

**Neon/Prisma gotchas:**
- Never use interactive `$transaction` — Neon PgBouncer kills long-running transactions. Use sequential queries with `createMany` for batch inserts.
- Add `SELECT 1` keepalive before DB-heavy operations that follow long AI processing stages (Neon suspends idle compute)
- Generation pipeline stale job threshold: 3 minutes. Failed jobs block retries until threshold passes.

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
| Skin picker component | [apps/web/components/SkinPicker.tsx](apps/web/components/SkinPicker.tsx) |
| Skin preview panel | [apps/web/components/SkinPreviewPanel.tsx](apps/web/components/SkinPreviewPanel.tsx) |
| LLM adapter | [packages/ai/src/llm-adapter.ts](packages/ai/src/llm-adapter.ts) |
| Video segmentation | [packages/ai/src/video-segmentation.ts](packages/ai/src/video-segmentation.ts) |
| Gemini video analyzer | [packages/ai/src/gemini-video-analyzer.ts](packages/ai/src/gemini-video-analyzer.ts) |
| Promo codes API | [apps/web/app/api/programs/[id]/promo-codes/route.ts](apps/web/app/api/programs/[id]/promo-codes/route.ts) |
| Platform checkout | [apps/web/app/api/checkout/platform/route.ts](apps/web/app/api/checkout/platform/route.ts) |
| Dashboard settings | [apps/web/app/dashboard/settings/page.tsx](apps/web/app/dashboard/settings/page.tsx) |
| Next.js config | [apps/web/next.config.ts](apps/web/next.config.ts) |
| Clerk middleware | [apps/web/middleware.ts](apps/web/middleware.ts) |
| Stripe client init | [apps/web/lib/stripe.ts](apps/web/lib/stripe.ts) |
