# Open Findings — Worth coming back to

Running list of QA-session findings that aren't fully resolved. Replaces the per-finding ticket-spam approach. Append, mark resolved inline, don't archive.

---

## ⏸ LLM doesn't reject off-topic content from a program assemblage — `fireship-coding-shorts` 2026-05-31

**Status: DEFERRED by product decision 2026-05-31.** Creator is responsible for curating their own program. No platform-side warning or block planned. Revisit only if real-creator data shows this is a frequent support issue.

Original finding preserved below for context.

---

### Original finding

**Severity:** medium-high — silent misuse of source material that learners would see.

**Symptom:** The `fireship-coding-shorts` program (6 videos: 5 Fireship 100-second coding intros + 1 Gordon Ramsay scrambled-eggs video, lessonCount=3) produced a curriculum where the Ramsay video was bundled into a "static type checking" coding lesson with no acknowledgment that the source content is unrelated. Judge dimensions: lesson_boundaries=1, lesson_count=2, step_flow=2, topic_boundary_respect=2 → overall 2.13 (FAIL). [Critical issues from judge](corpus-20260531-183412/fireship-coding-shorts/scores.json):
- "Gordon Ramsay scrambled eggs video bundled into a 'static type checking' coding lesson with no justification"
- "Lesson titles describe content that does not match the assigned clips (Lesson 1 promises JS/Python/Flutter but only plays React; Lesson 3 promises TypeScript but plays JS/Flutter/eggs/Python)"

**Why this matters:** in production, a creator could include a misclicked or thematically-mismatched video among their uploads. The pipeline does not flag this — it just packs everything into the lesson plan. The LLM tries to bridge the gap with generic placeholder titles ("Execute logic across multiple environments") rather than surface the misfit. A learner sees the inconsistency immediately.

**Pipeline-layer attribution:** Curriculum-LLM is doing what it was asked — fit N videos into M lessons. There is no upstream "off-topic detector" stage. The clip distributor preserves source-video adjacency but doesn't compute thematic distance between videos.

**Levers worth discussing:**
1. **Pre-LLM thematic check** — embed each video's `topic` labels + summary and cluster them; warn the creator when a cluster contains an outlier (cosine distance > threshold)
2. **LLM-driven outlier surface** — extend the curriculum prompt to ask "list any source video that does not fit the program's transformation in 1 sentence" before generating lessons
3. **Accept silently** — current behavior; document the creator's responsibility for curating their own corpus

**Corpus-author note:** the Ramsay video was deliberately mixed into the Fireship bundle by the harness author to bring the lesson count to 6. The mix is artificial but the failure mode it exposes is real.

---

## ✅ validateAndFixClipDistribution doesn't always produce a fixedDraft — RESOLVED 2026-05-31 (route protection verified + harness mirrors it)

**Status:** Originally flagged as the validator silently letting phantom clips through. After re-reading the route, **production is already protected**: [generate-async/route.ts:911–914](../../apps/web/app/api/programs/[id]/generate-async/route.ts) throws when `fixedDraft` is null, and lines 904–909 throw when the repaired draft fails re-validation. Learners cannot see clip-hallucination output today — the job fails loudly first.

The harness was producing fixture data inconsistent with production behavior (it captured the unrepaired draft instead of failing). Now mirrored in [apps/web/scripts/youtube-fixture-corpus.ts](../../apps/web/scripts/youtube-fixture-corpus.ts) `assembleProgram`: writes `.failure.json` artifact when no `fixedDraft` is available, matching the route's throw semantics.

The deeper question — why the validator gives up on `fireship-coding-shorts` specifically — is now diagnosable cleanly: the route's throw exposes the error list, so future debug has signal instead of silent fallback.

---

## 🔧 LLM produces clip ranges beyond video duration — FIX SHIPPED 2026-05-31 (prompt constraint added)

**Fix:** [packages/ai/src/clip-distributor.ts](../../packages/ai/src/clip-distributor.ts) `formatDistributionPlanForPrompt` now emits a `HARD BOUNDS` block listing each video's `durationSeconds` and stating that clips MUST NOT reference seconds beyond the video's actual length. The LLM previously was told "do not change these values" but had no explicit upper bound; now it has both.

Verification pending: re-run `assemble beauty-isolated` and confirm the validator's repair count drops from 4 → 0 (meaning the LLM stopped hallucinating ranges, not that the validator fixed them).

---

### Original finding

**Severity:** high. Validator catches it in production, but it's silently doing heavy repair every run.

**Symptom:** [program-beauty-isolated.draft.json](../qa-fixtures/corpus/program-beauty-isolated.draft.json) (NikkieTutorials, 914s source video) produced clips at `706–1146` and `1146–1514`. Both `endSeconds` values exceed the video's `durationSeconds=914`. A learner playing those clips would hit empty / past-end content.

**What the layers actually produced:**
- [program-beauty-isolated.distribution-plan.json](../qa-fixtures/corpus/program-beauty-isolated.distribution-plan.json): correct — clip ranges 0–706 and 706–914, exactly matching Gemini's topic boundaries
- LLM `generateProgramDraft` output: incorrect — generated 706–1146 and 1146–1514, ignoring the plan
- The chapter descriptions reference real source content (launch dates, kids makeup challenge) — the LLM correctly identified the topics but hallucinated timestamps for them

**Why this matters even though the validator catches it:** [route.ts:887](../../apps/web/app/api/programs/[id]/generate-async/route.ts) calls `validateAndFixClipDistribution` and repairs the draft before persisting. So learners don't see broken clips. But it means *every generation involving this content shape* is silently running heavy repair work, and any future bug in the validator silently lets phantom clips through. The LLM should be respecting its plan more reliably.

**Pipeline-layer attribution:** This is a curriculum-LLM bug, not a clip-distributor bug. The plan was correct; the LLM ignored it.

**Surface:** found via the corpus harness ([apps/web/scripts/youtube-fixture-corpus.ts](../../apps/web/scripts/youtube-fixture-corpus.ts)) running `assemble beauty-isolated`. Judge flagged it on first scoring run: `topic_boundary_respect: 1`.

---

## 🔧 Gemini empty-response failure rate ~30% on the structured analysis prompt — FIX SHIPPED 2026-05-31 (retry + diagnostics)

**Fix:** [packages/ai/src/gemini-video-analyzer.ts](../../packages/ai/src/gemini-video-analyzer.ts) now wraps both `analyzeVideoWithGemini` (YouTube path) and the analysis call inside `analyzeUploadedVideoWithGemini` (Upload path) with a 3-attempt retry loop using jittered backoff. Final-attempt error messages now include `finishReason`, `safetyRatings`, and `promptFeedback` via `formatGeminiDiagnostics` so future failures are immediately diagnosable without a separate `gemini-diag.ts` invocation.

Verification pending: re-run `analyze-retry` against the 4 stuck videos (Molly Wright, Tia Graham, Ken Robinson, GLy YWA 45min) — confirm at least 1–2 recover with the retry, and the persistent failures now expose a clear `finishReason` in the error message.

---

### Original finding

**Severity:** medium — fails silently in production, video falls through to title-only digest path → degraded downstream curriculum quality.

**Symptom:** 30-video corpus run: 8/30 (27%) hit `Gemini returned empty response` from [packages/ai/src/gemini-video-analyzer.ts:425](../../packages/ai/src/gemini-video-analyzer.ts) — Gemini returned a candidate with `finishReason=STOP` but `content.parts[0].text` empty.

**Diagnostic:** [apps/web/scripts/gemini-diag.ts](../../apps/web/scripts/gemini-diag.ts) hit zQnBQ4tB3ZA (one of the failed videos) with a SIMPLE prompt → 200 OK, valid response, `finishReason=STOP`, 319 chars of content. So:
- Gemini CAN access the video (not safety, not region, not recitation)
- Failure is **prompt-specific** — the long structured `buildVideoAnalysisPrompt` triggers it
- Failures are **partly transient** — `analyze-retry` recovered DHjqpvDnNGE (JavaScript Fireship) on second attempt

**Production impact:** route catches the error at [route.ts:496](../../apps/web/app/api/programs/[id]/generate-async/route.ts) and continues. Failed videos get no `VideoAnalysis` row → digest stage falls into title-only fallback at [route.ts:631](../../apps/web/app/api/programs/[id]/generate-async/route.ts) → no enriched clips, no topic-aware curriculum. The video is "in" the program but the brain has nothing to work with.

**Levers to consider:**
1. Add a retry-with-jitter in [gemini-video-analyzer.ts](../../packages/ai/src/gemini-video-analyzer.ts) for empty-response specifically (the Mux path already retries on `Gemini file processing failed`)
2. Surface `finishReason` in the error message so future debug doesn't need a one-off diagnostic
3. Consider falling back to a simpler prompt + a second structured-extraction pass on the simple output

---

## 🔧 Gemini 5-min timeout hits on 30+ min videos — FIX SHIPPED 2026-05-31 (env-configurable + tiered)

**Fix:** [packages/ai/src/constants.ts](../../packages/ai/src/constants.ts) now exports `DEFAULT_GEMINI_ANALYSIS_TIMEOUT_MS = 300_000` plus `getGeminiAnalysisTimeoutMs(videoDurationSeconds?)` resolver. The resolver tiers headroom by video length:
- `< 10 min` → base (300s)
- `10–30 min` → base + 120s = 420s
- `≥ 30 min` → base + 300s = 600s

Env override: `GEMINI_ANALYSIS_TIMEOUT_MS` adjusts the base; tiers stack. Both `analyzeVideoWithGemini` (YouTube path) and `analyzeUploadedVideoWithGemini` (Upload path) use the resolver. The Upload path now also accepts an optional `durationSeconds` parameter so the route can pass the value through.

Verification pending: re-run analyze on `GLy2rYHwUqY` (YWA 45min) — confirm extended 600s timeout (default for ≥30min videos) lets it complete.

---

### Original finding

**Severity:** medium — known production failure mode for long uploads.

**Symptom:** 4/30 corpus videos hit `This operation was aborted` from the 5-min `GEMINI_TIMEOUT_MS` in [gemini-video-analyzer.ts:16](../../packages/ai/src/gemini-video-analyzer.ts). All four are 30+ min videos: Bad Romance + Squabble Up dance tutorials, YWA 30min, YWA 45min.

**Implication:** any creator uploading 30+ min videos has a meaningful chance of falling out of the brain entirely. Most successful 30+ min videos in the corpus took 100–230s, close to but under the 5-min ceiling. The current ceiling has very little headroom for the long-form case.

**Levers:**
1. Bump `GEMINI_TIMEOUT_MS` for the Mux path specifically (longer uploads are the common case there)
2. Add a one-time retry on `AbortError`
3. For videos > N minutes, route to the Files API + a different prompt that requests sparse output

---

## 📦 Stress-test harness — bypass-the-route corpus run 2026-05-31

**Severity:** infrastructure — new addition to the QA toolchain.

**What landed:** a 4-script harness for stress-testing steps 3–6 (Gemini segmentation → digest extraction → clip distribution → curriculum gen) without touching the running app. Lives under [apps/web/scripts/](../../apps/web/scripts/) — pure scripts, zero production code changes, zero DB writes.

| File | Role |
|---|---|
| [corpus-config.ts](../../apps/web/scripts/corpus-config.ts) | 30 YouTube videos × 10 programs, organized by duration tier + content shape |
| [youtube-fixture-corpus.ts](../../apps/web/scripts/youtube-fixture-corpus.ts) | `list` / `analyze` / `analyze-retry` / `assemble` / `full` commands. Resumable; per-video failure isolation; mirrors production by calling `validateAndFixClipDistribution` |
| [qa-judge-corpus.ts](../../apps/web/scripts/qa-judge-corpus.ts) | Sibling to existing [qa-judge.ts](../../apps/web/scripts/qa-judge.ts) — same prompt, same `---JSON---` delimiter, same `tests/qa-results/<ts>/` output. Reads JSON fixtures instead of pulling from Prisma. |
| [gemini-diag.ts](../../apps/web/scripts/gemini-diag.ts) | One-shot Gemini call with full raw response logging (finishReason, safetyRatings, usage). Use to investigate "empty response" cases. |

Fixtures land under [tests/qa-fixtures/corpus/](../qa-fixtures/corpus/). Judge results land alongside existing runs under [tests/qa-results/corpus-<timestamp>/](.).

**Why this exists rather than going through the route:** the current `generate-async` orchestrator only routes Mux uploads to Gemini; YouTube URLs cannot reach `analyzeVideoWithGemini` through the route ([route.ts:371–389](../../apps/web/app/api/programs/[id]/generate-async/route.ts) filters on `muxPlaybackId`). The harness calls the AI package functions directly, so YouTube URLs become a cheap, reusable ingest source for stress testing the content brain without burning Mux storage or manual uploads.

**Production parity:** strong at the schema/prompt level (same `buildVideoAnalysisPrompt`, same Zod schema, same temperature) and now mirrors production's clip validation step. Weak at the wire/upload level (no Files API exercise, no static-rendition wait, no Mux webhook race). That gap is intentional — see plan in `/Users/Rotenberg_Mathew/.claude/plans/ok-we-re-getting-close-wild-spark.md`.

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

## ✅ Clip-range straddle at the *plan* layer — RESOLVED 2026-05-14 (upper-body-workout half)

**Severity:** medium/high — addressed half of ticket 86e1cgy5q. Snap-window root cause now fixed for the upper-body-workout case; `workout-like-a-champ` Cable Rope Pushdown case to re-verify after the within-video order fix landed.

**Symptom (2 instances observed):**
- `upper-body-workout` L1 cuts at 410s; segments end at 267, 542 (mid-segment cut) — **now cuts at 542 (boundary)** ✅
- `workout-like-a-champ` Cable Rope Pushdown segment (1267–1506s) split at 1363s across L5 and L7 — same Gemini segment in two different lessons — needs re-run

**Root cause:** [packages/ai/src/clip-distributor.ts:84](packages/ai/src/clip-distributor.ts#L84) — `timeBasedSlices` had segments as snap candidates after the 2026-05-13 fix, but the fixed 60s snap window was too tight when slice spacing was much larger than 60s (e.g. 2-way 800s-video split has 400s spacing; nearest boundary sat 132s away, outside the window).

**Fix shipped 2026-05-14 (commit fb8a457):** adaptive snap window = `clamp(60, sliceSpacing * 0.35, 240)`. For a 400s spacing → 140s window. For a 5-min chunk → still 60s (unchanged behavior). +1 test.

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

## ✅ LLM ignores source-video sequence when grouping into lessons — RESOLVED 2026-05-14

**Severity:** medium. New finding from `workout-like-a-champ` 2026-05-14. **Resolved same day.**

**Symptom:** Source video "Chest and Triceps B" has exercises in order: Machine Chest Press (0-258) → Low Pulley Cable Fly (258-510) → Machine Chest Fly (510-775) → Decline Cable Crossover (775-1024). The LLM put these into Lessons **3, 3, 1, 8** respectively — i.e., a learner doing the program in order goes Machine Chest Fly (L1) → mobility stuff → Press + Cable Fly (L3) → … → Decline Crossover (L8).

**Actual root cause (not the LLM):** Two bugs in `distributeClipsToLessons` were locking the scramble in BEFORE the LLM ever saw it. The within-video prompt rule shipped 2026-05-13 couldn't fix it because the clip-to-bag mapping was already fixed.

1. **Bin-packer different-video-first swap** ([packages/ai/src/clip-distributor.ts:489](packages/ai/src/clip-distributor.ts#L489)) pushed same-video clips *back* past their own later siblings, scrambling source order within a single video.
2. **Split-to-fill** ([packages/ai/src/clip-distributor.ts:389](packages/ai/src/clip-distributor.ts#L389)) sorted the clips array by duration and pushed new split halves to the END of the array, separating split siblings across non-contiguous indices so the bin-packer placed them in non-adjacent lessons.

**Fix shipped 2026-05-14 (commits fb8a457 + 2b4be57):**
- Guard the swap: skip when the displaced clip still has later same-video siblings.
- Replace sort-then-push with linear argmax + splice-insert-after, preserving source-video adjacency across split iterations.

Verified live on `workout-like-a-champ` cmp4yqlvv0001it8hip72dqk2: "Chest and Triceps B" 3 split parts now land in L4 → L5 → L6 in source order. +2 tests.

---

## 🚧 Multi-clip lessons have unintuitive part-navigation UX — `9th-degree` 2026-05-23

**Severity:** medium. Real user impact: a learner could finish part 1 of a multi-part lesson and never realize part 2 exists.

**Symptom:** Lesson 2 of program `cmphuu9ob0001js04rercugrj` is structurally a clean 2-clip split (the judge rewarded it 5/5 on topic boundary respect — clean 299s break). But in the learner UI the second clip is essentially hidden:
- Top of card shows "WATCH · 2 PARTS · 9 MIN" (only signal that >1 part exists)
- Player chrome is a single video, no part-tabs or thumbnails for part 2
- Only navigation is a small `← →` arrow row at the bottom of the player with the chapter title in the middle

**Auto-advance status:** [InlineChainedPlayer.tsx](apps/web/components/viewer/InlineChainedPlayer.tsx) does call `onClipEnd` when a clip finishes and advances `currentIndex` to play the next clip with `autoPlay={true}`. So if a learner watches part 1 to completion, part 2 *should* auto-play. **But** if they pause partway through (the common case for a 5-min instructional clip), they'll never trigger the handler and have no visual indication that part 2 exists beyond the small arrows.

**Aggravating decision tonight:** the 2026-05-22 fix removed the "Part 1 of 2" text from the bottom row because it was deemed redundant with the top "2 PARTS" label. In hindsight that made discoverability worse — the position indicator was a constant reminder during playback that more was coming. The top label only flashes once on card open.

**Fix paths:**
1. **Cheapest:** restore a position dot row or "1 / 2" subtle indicator in the bottom navigation row. Doesn't bring back full "Part 1 of 2" text but keeps a non-redundant progress signal in view during playback.
2. **Better:** render the parts as a thumbnail strip below the player (each clip = a clickable thumbnail with title underneath). Visible at-a-glance, harder to miss.
3. **Best:** in addition to the strip, surface a "Up next: {part 2 title}" overlay during the last 10 seconds of part 1 — common YouTube pattern. Most discoverable.

Recommendation: ship (1) immediately, plan (2) for the next UI pass. Defer (3) until we have a few real learner sessions to see if the auto-advance is actually invisible in practice.

---

## 🔥 Wizard "Uploading N videos…" sticks forever after Mux PUT hang — `9th-degree-healing` 2026-05-22

**Severity:** HIGH — user-visible blocker. The wizard's Generate button stays greyed out indefinitely even after Mux has finished processing all uploads. Reproduced live tonight on `cmphqa7y00001l1048sgizlir`: 4 videos all `muxStatus: ready` in DB, but UI stuck on "Uploading 4 videos…" for 8+ minutes. User had to hard-refresh to unblock.

**Root cause:** [apps/web/components/wizard/steps/StepContent.tsx:221-295](apps/web/components/wizard/steps/StepContent.tsx#L221-L295) — `uploadVideoBlob` uses `XMLHttpRequest` for the Mux direct-upload PUT and **sets no timeout**. The browser's default XHR timeout is `0` (infinite). If Mux receives the bytes but the response packet is lost (proxy timeout, TCP RST, Wi-Fi blip after the upload finishes), none of `load` / `error` / `abort` events fires. The promise from `new Promise<void>((resolve, reject) => ...)` never settles.

Caller pattern at [StepContent.tsx:466-475](apps/web/components/wizard/steps/StepContent.tsx#L466-L475):
```ts
onUploadingCountChange?.(videoFiles.length);   // sets count > 0
const batchResults = await Promise.allSettled(batch.map(uploadVideoBlob));  // ← blocks forever on hung promise
// ...
onUploadingCountChange?.(0);                    // never runs
```

`Promise.allSettled` blocks until every promise resolves OR rejects. A neverlosing-settle promise pins it forever. The reset-to-zero never fires, the wizard's `uploadsInProgress` stays true, Generate stays disabled. Meanwhile Mux server-side completes processing and fires `video.asset.ready` → DB shows `muxStatus: ready` while UI shows "still uploading."

**Fix paths (ranked):**
1. **XHR timeout + timeout handler** (~10 LOC, immediate ship). Set `xhr.timeout = 10 * 60 * 1000` (10 min cap per video) and add `xhr.addEventListener("timeout", () => reject(new Error("Upload timed out")))`. Caps the hang at the timeout instead of forever. Doesn't help if Mux truly succeeded but the response was lost — that file would be marked failed in the UI even though it's fine server-side.
2. **Post-upload muxStatus poll fallback** (~30 LOC). After XHR timeout/error, poll `/api/programs/{id}/videos` for the file's `muxStatus` for up to N seconds. If it hits `ready` (Mux did process it despite the lost response), treat the upload as successful and continue. Recovers the case where bytes arrived but response was lost.
3. **Per-file uploadingCount tracking** (refactor). Decrement count on each settle (success OR fail) rather than waiting for the whole batch. Even with bug #1 unaddressed, the UI degrades to "Uploading 1 video…" instead of "Uploading 4…" — and the spinner only sticks on the actually-hung upload, not the others.

**My pick:** ship (1) immediately, follow up with (3) for resilience. (2) is overkill for the symptom but might be needed if the user reports recurring stuck uploads after (1).

---

## 🔥 Generation falls through to "no enriched digests" branch when Gemini analysis fails — `9th-degree-healing` 2026-05-22

**Severity:** HIGH — silent data loss. The program "generates successfully" but the learner sees 8 lessons with no video content attached.

**Symptom:** Program `cmphqa7y00001l1048sgizlir` ("9th degree healing"), 4 Mux-ready videos. Generation job `1j3zc3b0` completed at 100% in ~3 min. But:
- All 4 videos: `analysis: NO` — Gemini never produced a VideoAnalysis record
- All 8 sessions: `compositeSession: NULL` — no clips attached
- Lesson titles are coherent and topical (chakras, aura, Cook's Crossover, Body Pendulum) — LLM hallucinated curriculum from video titles alone
- WATCH actions exist on every session but reference no video

**Root cause (probable):** Generation route at [apps/web/app/api/programs/[id]/generate-async/route.ts:612-614](apps/web/app/api/programs/[id]/generate-async/route.ts#L612-L614) — when `enrichedOnly.length === 0`, the route logs "No enriched digests — skipping clip distribution (LLM will assign freely)" and proceeds to LLM generation with basic digests only. LLM produces lesson skeleton; no clips get attached because there's no distribution plan.

The upstream cause — why analysis was never produced — needs Vercel runtime logs to confirm, but likely one of:
1. Vercel function timeout aborted the analysis stage before persistence (same `This operation was aborted` family as the resolved menopause failures 2026-05-19)
2. Mux MP4 static rendition not ready when route polled, polling exceeded deadline
3. Gemini error swallowed at the analysis call site

**The bigger design issue:** the "skip distribution" fallback should not silently produce a working-looking program. Options:
1. **Hard-fail the job** when enriched digests are empty for a program that has videos. Better UX than a generated-but-useless program — the user knows to retry.
2. **Defer to webhook + retry.** If Gemini hasn't finished, mark the job PENDING_ANALYSIS and resume when webhooks fill in analyses. Async re-entry pattern.
3. **Always run analysis inline before LLM, with sufficient deadline budget.** Requires the parallel-Gemini work (already shipped 2026-05-13/14) plus the rendition-polling fix from OPEN-FINDINGS pipeline-speed item (#2).

Step 1 first ("hard fail loudly when no analysis exists"). Then we can argue about the right async pattern.

---

## 🚧 Across-video lesson order interleaves source videos — `reset-menopause` 2026-05-19

**Severity:** medium. Different bug from the resolved 2026-05-14 within-video scramble. That one was clips of *one* video landing in non-source-order across lessons; this one is *whole different videos* being interleaved across lessons.

**Symptom:** Program `cmpc26f3t0001k0041o2t3s4f` ("Reset w manopause") — 4 source videos → 8 lessons. Lesson-to-source-video mapping:

| Lesson | Source video | Clip range (s) |
|---|---|---|
| W1 | b8jw8g6o (40/30/30) | 0–289 |
| W2 | utjfi7ej (Intro) | 0–266 |
| W3 | mc7xqi6j (Nutrition) | 0–339 |
| W4 | mc7xqi6j (Nutrition) | 339–687 |
| **W5** | **hldg8zrc (Science)** | **0–308** |
| **W6** | **mc7xqi6j (Nutrition)** | **687–898** |
| W7 | hldg8zrc (Science) | 308–588 |
| W8 | hldg8zrc (Science) | 588–859 |

mc7xqi6j is split across W3 + W4 + W6 with W5 (a different source video) wedged in the middle. Within-video order is correct (the 2026-05-14 fix held). What's wonky is **across-video** sequencing — a learner gets "nutrition · nutrition · *hormone biology* · nutrition · hormone biology · hormone biology", which is jarring topically and structurally.

**Likely root cause:** The LLM is grouping by curriculum theme, not by source video. mc7xqi6j has too much content for one lesson, so it gets sliced into three. hldg8zrc gets sliced too. Without a constraint requiring same-video lessons to be contiguous, the LLM is free to interleave them however reads best curricularly — but the result feels disjointed in the learner UI.

**Brainstorm — five fixes ranked by effort:**

1. **Post-process pass: cluster same-video lessons (smallest change, mechanical).** After `distributeClipsToLessons` runs, reorder the lessons so every group of same-source-video lessons sits contiguously. Preserve within-video order. Single function in `clip-distributor.ts`, easy to unit-test. Risk: the LLM-chosen lesson titles/objectives were authored assuming a certain narrative arc; reordering may produce a curriculum that pedagogically jumps around (e.g., "advanced nutrition" before "intro to hormones").
2. **Hard constraint at distribution layer.** Same as (1) but enforced *before* the LLM names lessons — partition clips into per-video bags first, then call LLM per bag for titles. The LLM never sees the global mix, so it can't interleave. More invasive — changes the LLM contract — but produces the right curriculum titles too.
3. **Soft prompt constraint.** Add a rule to the LLM prompt: "Group all clips from the same source video into contiguous lessons. Do not interleave videos." Cheapest to try, but unreliable — LLMs ignore soft rules under conflicting incentives, and the topic-coherence pull is strong here. Worth A/B testing alongside (1).
4. **Source-video sequencing pass before LLM call.** Decide source-video order upfront (heuristics: shortest "intro" first, longest "deep dive" last; or first upload timestamp), then feed clips to the LLM in fixed video chunks. Lessons sequence is implicit. Closest to how a human curriculum designer would think.
5. **Make it a creator choice.** Add a wizard toggle: "Lesson order: follow my video order" vs. "let AI design the flow". Default to the former for safety. Punts the question to the user but legitimizes both behaviors.

**Recommendation:** Start with **(1)** — single-file mechanical pass with a unit test on the menopause shape. If lesson narrative reads broken after reordering, escalate to **(2)**. Skip (3) unless we want a 30-min experiment.

**Verify with:** rerun judge on `cmpc26f3t0001k0041o2t3s4f` after fix; expect mc7xqi6j to occupy W3+W4+W5 and hldg8zrc to occupy W6+W7+W8 (or similar contiguous block).

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

## 🟧 Route-level `JOB_TIMEOUT_MS` (10 min) is consumed by `fetching_transcripts` waits, leaving zero budget for `persisting` — 2026-06-02

**Severity:** medium — silent failure mode on real uploads with longer videos. Surfaced by [apps/web/scripts/bulk-mux-upload.ts](../../apps/web/scripts/bulk-mux-upload.ts) (upload harness Script A) on its first end-to-end run.

**Symptom:** TEST-UPLOAD program with 2 videos (8MB AWS short + 174MB 18-min dance tutorial). Wait phase for the dance video's Mux static rendition burned 9 min 37s in `fetching_transcripts`. `generating` succeeded in 2m 34s, `validating` in 15ms — then `persisting` immediately threw `"Job timed out after 10 minutes during persisting stage"`. The job reached 90% progress and died at the DB-write step despite the LLM having returned a valid draft.

```
job cmpw4zuyh0001la04nwlsd5ga steps:
  preparing                51ms     ok
  fetching_transcripts     577228ms ok   ← 9m 37s burned on Mux wait
  analyzing                25ms     ok
  generating               153898ms ok   ← LLM returned cleanly (llm_elapsed=153881ms)
  validating               15ms     ok
  persisting               14ms     error "Job timed out after 10 minutes during persisting stage"
```

**Pipeline-layer attribution:** Route-level deadline accounting at [generate-async/route.ts:180-186](../../apps/web/app/api/programs/[id]/generate-async/route.ts) treats the wait phase and LLM phase as fungible against the same 10-min budget. They aren't — wait is bounded by Mux's render time (1-10 min for long videos), LLM by Anthropic latency. Tracking them together means a slow upstream stage starves downstream stages of budget they need.

**Levers to consider:**
1. Per-stage budgets instead of one route-wide ceiling (give `persisting` its own ≥30s reservation that can't be eaten)
2. Reset the deadline after `fetching_transcripts` completes, since by then the long-pole work is done
3. Skip the deadline entirely for `persisting` (DB writes shouldn't be gated by a wall-clock that started 10 min ago)
4. Move the wait phase outside `JOB_TIMEOUT_MS` and let it run against `maxDuration = 800s` (Vercel's hard ceiling) directly

---

## 🟧 LLM call aborts at ~153s during `generating` with "This operation was aborted" — 2026-06-02

**Severity:** medium — second run of the harness (retry against cached analyses) hit this. The fetch is configured for `GENERATION_TIMEOUT_MS = 600_000` (10 min) at [llm-adapter.ts:22](../../packages/ai/src/llm-adapter.ts#L22), but the abort fires at 152.8s — almost exactly where the previous successful run's LLM call had finished (153.9s).

**Symptom:** Same TEST-UPLOAD program, retry triggered with both Gemini analyses cached:

```
job cmpwmewhj0001js04d4dpl2t0 steps:
  preparing                64ms     ok
  fetching_transcripts     306490ms ok   ← still slow despite cached analyses (see next finding)
  analyzing                15ms     ok
  generating               152839ms error "This operation was aborted"
```

The error string is the AbortController.abort() message from `fetchWithTimeout` at [llm-adapter.ts:29-33](../../packages/ai/src/llm-adapter.ts#L29-L33), but that timer is set for 10 min — far past 152.8s.

**Hypothesis (unverified):** Anthropic's load balancer dropping the connection right around the response boundary, OR Vercel Fluid Compute recycling the function instance during a long server-to-server fetch from `after()`. The fact that the first run's LLM completed at 153.9s and the second's aborted at 152.8s suggests Anthropic's P50 for this prompt size sits right at the threshold of whatever's killing the connection.

**Pipeline-layer attribution:** Not the route, not the adapter timeout. External — Anthropic connection-level OR Vercel infrastructure. Needs deeper instrumentation (response headers, undici socket diagnostics) to confirm.

**Levers to consider:**
1. Wrap `callAnthropic` in a retry-with-backoff (1-2 attempts) — would absorb transient drops without code-change visibility
2. Stream the Anthropic response instead of awaiting full body — keeps the TCP connection live and detects drops earlier
3. Log undici socket errors via the global dispatcher's error events for better diagnostics
4. Move long-running LLM calls to a queue/worker rather than inline in a serverless function

---

## 🟧 `fetching_transcripts` is slow on retry even when `VideoAnalysis` rows are cached — 2026-06-02

**Severity:** low (UX papercut on regenerations, not a real failure mode). Surfaced alongside the abort finding above.

**Symptom:** Second job for the same program — both `VideoAnalysis` rows already populated from the first run — still spent 5 min 6s in `fetching_transcripts`. Step note was `analyzed=2/2 transcripts=2`, suggesting both got there eventually, but the path used should have been near-instant since [route.ts:251-253](../../apps/web/app/api/programs/[id]/generate-async/route.ts#L251-L253) filters the wait phase to videos missing both `analysis` and `muxPlaybackId`.

**Hypothesis (unverified):** The cached-analysis short-circuit may not be firing as expected, OR the wait phase is still running for one of the videos because something on the row state was reset between runs. Worth checking whether the first run's failure rolled back the `VideoAnalysis` writes that had landed mid-job.

**Pipeline-layer attribution:** Likely route logic — the cached-content fast path either isn't being detected or the cache key is mismatched. Read-only investigation: query `VideoAnalysis.createdAt` on both rows vs. the first job's stage timings.

---

## ✅ Resolved this session

- ✅ Anthropic API call timeout at 120s on 5-video programs (bumped GENERATION_TIMEOUT_MS to 600s)
- ✅ Emergency-fill clip splitter arithmetic halving (added segment-snap)
- ✅ Per-clip transcript excerpt truncation hiding sub-topics from the LLM (multi-segment enumeration)
- ✅ Gemini schema rejecting null speakerName (made fields nullish)
- ✅ LLM clip overlaps & coverage gaps post-Ticket-#2 (added per-(session, planned-range) validator with surgical repair)
- ✅ Gemini analysis runs serially — bottleneck on multi-video programs (added bounded-concurrency runner with 4-way parallel in `route.ts`, completion-based progress tracking, deadline + error handling preserved per task)

## ✅ Resolved 2026-05-14 session

- ✅ Regenerate-with-instructions UI orphaned without frontend (commit 073b5cb)
- ✅ `timeBasedSlices` 60s snap window too tight for long-spacing slices — adaptive window scales with slice size (commit fb8a457)
- ✅ Within-video source-order scramble in bin-packer different-video swap (commit fb8a457)
- ✅ Split-to-fill broke source-video adjacency when clipsCount < lessonCount (commit 2b4be57)
