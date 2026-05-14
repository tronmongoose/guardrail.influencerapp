# Open Findings — Worth coming back to

Running list of QA-session findings that aren't fully resolved. Replaces the per-finding ticket-spam approach. Append, mark resolved inline, don't archive.

---

## 🔥 Pipeline speed — generation takes way too long

**Severity:** big fix, prioritize early next session.

**Symptom:** 15-video "Power yoga" fixture timed out at the previous 10-min hard cap during `fetching_transcripts`. Bumped local to 30 min as a Band-Aid. Even 10 min is unacceptable UX.

**Root cause:** Gemini analysis is the dominant cost and runs **strictly serially** in [apps/web/app/api/programs/[id]/generate-async/route.ts](apps/web/app/api/programs/[id]/generate-async/route.ts) — one video at a time, each ~30-60s. 15 videos × 45s ≈ 11+ min just there. Mux MP4 rendition polling adds more. LLM call is a small fraction.

**Concrete levers (ordered by impact / effort):**

1. **Parallelize Gemini analysis (~30 LOC, biggest win).** Today: serial loop. Change to `Promise.all` with a concurrency cap (say 4). For 15 videos at 45s each, drops wall-clock from ~11 min to ~3 min. Bounded by Gemini API rate limit (worth checking — likely fine at 4-way parallel) and by local memory.
2. **Drop the polling wait for MP4 rendition (~20 LOC).** Today: polls Mux every 5s until rendition is ready. Could subscribe to a webhook OR start Gemini analysis off the original Mux playback URL instead of waiting for the capped-1080p rendition. The wait is pure latency, no compute.
3. **Cheaper Gemini model for short videos.** Today: `gemini-3.1-pro-preview` (slow, high-quality). For videos under e.g. 2 min, `gemini-3-flash` is ~3-5x faster with comparable structural output for our use case (we mostly need segments + topics + transcript, not deep reasoning).
4. **Cache aggressively across regenerations.** Already partly done — analyses persist on `YouTubeVideo.analysis`. Verify the cache is hit on every regen, not just the ones that succeeded last time.
5. **(Production-level) Vercel Workflow migration.** For long pipelines, Vercel Workflow gives durable step-based execution past the 800s function timeout. Step-per-video + step-for-LLM + step-for-persistence. Crash-safe.

**My recommendation when we pick this up:** parallelize first (1) — it's a single-file change with the biggest immediate wall-clock win. Then drop the rendition wait (2) for another ~5-30s shaved per video. The model swap (3) and Workflow migration (5) are bigger conversations to have together.

**Why this matters:** every QA iteration costs us 5-15 min today. A 4x speedup means 4x more variations testable in the same evening. This is the multiplier on every other fix.

---

## 🚧 Clip-range straddle still present at the *plan* layer — confirmed on 2 fixtures

**Severity:** medium/high — addressed half of ticket 86e1cgy5q. Straddle remains, and now confirmed on a second fixture.

**Symptom (2 instances observed):**
- `upper-body-workout` L1 cuts at 410s; segments end at 267, 542 (mid-segment cut)
- `workout-like-a-champ` Cable Rope Pushdown segment (1267–1506s) split at 1363s across L5 and L7 — same Gemini segment in two different lessons

**Root cause:** [packages/ai/src/clip-distributor.ts:84](packages/ai/src/clip-distributor.ts#L84) — `timeBasedSlices` only uses **topic** boundaries for snapping, not segments. When a long video has one big topic (no thematic distinctness), there are no snap candidates → arithmetic cuts straddle (and worse, split) the finer-grained segments.

**Fix scoped but deferred (user asked to park):** extend `timeBasedSlices` to accept segments as additional snap candidates, dedupe with topics, snap to whichever is closer within ±60s. ~20 LOC, mirrors the segment-snap approach already in `findSegmentSnapForSplit`. With 2 distinct fixtures hitting this, the parking is worth revisiting.

---

## 🚧 WATCH step fragmentation — clips rendered as N separate WATCH actions per lesson

**Severity:** HIGH — confirmed user-visible UX bug, not just a judge nit. Same root cause as every "no WATCH step" judge complaint.

**Symptom:** On `shorts-mashup` Lesson 1 (6 yoga clips), the learner UI shows **6 separate "Part X of 6 · WATCH" entries**, each its own video player with its own "Mark as watched" checkbox — plus a separate PRACTICE step plus a REFLECT step. Result: 8 actions per lesson where the intended design is **3** (WATCH, PRACTICE, REFLECT).

**Root cause:** The LLM only generates `Action` rows of type `DO` + `REFLECT` (per direct DB inspection across every fixture). No `WATCH`-typed Action exists. The `SessionClip` rows hanging off the `CompositeSession` are rendered as faux-WATCH steps in the UI. With Ticket #2's per-segment subdivision encouraging more SessionClips per lesson, the fragmentation got dramatically worse — 6 clips = 6 "WATCH" entries instead of 1.

The judge has been correct every time. It looks at `actions = [DO, REFLECT]` and sees no WATCH step. The UI papers over the data shape with per-clip rendering, but the user experience is exactly the janky fragmentation the judge predicted.

**Intended design (per user):** 1 WATCH step per lesson that plays all clips chained with chapter markers in a single player.

**Likely fix surface:**
- LLM prompt: require a single WATCH-typed Action per session that "owns" the clips collectively
- Learner UI: render the CompositeSession as one WATCH entry with internal chapter markers (using existing chapterTitle/chapterDescription per clip)
- Player: chain clips back-to-back in one MuxPlayer instance instead of one-player-per-clip

Most likely both prompt + UI changes. Worth digging in once parallelization is in.

---

## 🆕 LLM ignores source-video sequence when grouping into lessons

**Severity:** medium. New finding from `workout-like-a-champ` 2026-05-14.

**Symptom:** Source video "Chest and Triceps B" has exercises in order: Machine Chest Press (0-258) → Low Pulley Cable Fly (258-510) → Machine Chest Fly (510-775) → Decline Cable Crossover (775-1024). The LLM put these into Lessons **3, 3, 1, 8** respectively — i.e., a learner doing the program in order goes Machine Chest Fly (L1) → mobility stuff → Press + Cable Fly (L3) → … → Decline Crossover (L8).

**Root cause hypothesis:** The curriculum prompt has strong workflow-sequencing rules ("foundational → refinement") but doesn't have an explicit "preserve source-video order within a single video" rule. When the LLM clusters exercises across multiple source videos, it ranks them on workflow-difficulty rather than source-video order, scrambling each video's internal arc.

**Suggested fix:** Add a prompt instruction: *"When multiple lessons draw clips from the same source video, the lesson ordering must place those lessons in the order the clips appear in the source video. Do not reorder exercises within a single video."*

May also need to look at whether `distributeClipsToLessons` is assigning clips to lessons in a way that allows this scrambling, or whether it's purely the LLM's lesson-ordering layer.

---

## 🚧 Lesson 4 chapterTitle doesn't enumerate all subtopics

**Severity:** low. Specific case observed on `upper-body-workout` post-fix run.

L4 chapterTitle says "Triceps Bench Dips and Cable Rope Pushdowns" but the clip range 1024-1702 includes a third exercise (Dumbbell Triceps Kickback at 1506-1702). Ticket #2's "MUST reflect all segments" prompt instruction didn't fire here because the clip spans a single Gemini topic with subtopics, not multiple segments. Probably needs the prompt to enumerate subtopics too when present.

---

## 📦 Shippable code changes — uncommitted in working tree (2026-05-13)

All these are **real fixes** that should ship to prod. Currently they only exist in your local files. Commit/PR before the next dev cycle so they don't get lost.

| File | Change | Ship to prod? |
|---|---|---|
| `packages/ai/src/llm-adapter.ts` | `GENERATION_TIMEOUT_MS` 120s → 600s | ✅ yes — needed for >2-video programs |
| `packages/ai/src/clip-distributor.ts` | Segment-snap in emergency-fill (Ticket #1) | ✅ yes |
| `packages/ai/src/clip-distributor.ts` | Multi-segment prompt enumeration (Ticket #2) | ✅ yes |
| `packages/ai/src/clip-distributor.ts` | Per-(session, planned-range) validator + surgical repair (Ticket #3) | ✅ yes |
| `packages/shared/src/schemas.ts` | Gemini schema fields → `.nullish()` (accepts null speakerName etc.) | ✅ yes |
| `apps/web/__tests__/clip-distributor.test.ts` | 8 new test cases covering the above | ✅ yes |
| `tests/` (new) | QA harness — fixtures + judge script + judge prompt + run results | ✅ yes — separate commit or PR |
| `apps/web/app/api/programs/[id]/generate-async/route.ts` | Parallel Gemini analysis (4-way bounded concurrency) — the gamechanger | ✅ yes — this is the main speedup |
| `apps/web/app/api/programs/[id]/generate-async/route.ts` | **`JOB_TIMEOUT_MS` 10min → 30min — LOCAL DEV ONLY** | ⚠️ **NO** — needs to be reverted before shipping. With parallel Gemini, the original 10min should be plenty for any realistic creator workload. |

Suggested commit organization when shipping:
1. One commit for the pipeline fixes (llm-adapter + clip-distributor + schemas + tests) — the substance of two days' QA work
2. Separate commit/PR for the harness (`tests/` dir) — it's QA infrastructure, not product code
3. Revert the `JOB_TIMEOUT_MS` bump before either; ship it together with the parallelization fix in a follow-up

---

## ✅ Resolved this session

- ✅ Anthropic API call timeout at 120s on 5-video programs (bumped GENERATION_TIMEOUT_MS to 600s)
- ✅ Emergency-fill clip splitter arithmetic halving (added segment-snap)
- ✅ Per-clip transcript excerpt truncation hiding sub-topics from the LLM (multi-segment enumeration)
- ✅ Gemini schema rejecting null speakerName (made fields nullish)
- ✅ LLM clip overlaps & coverage gaps post-Ticket-#2 (added per-(session, planned-range) validator with surgical repair)
- ✅ Gemini analysis runs serially — bottleneck on multi-video programs (added bounded-concurrency runner with 4-way parallel in `route.ts`, completion-based progress tracking, deadline + error handling preserved per task)
