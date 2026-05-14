# QA Harness Run — 2026-05-11

## Run details
- **Run dir:** `tests/qa-results/20260511-234146/`
- **Fixture:** `get-well-soon` (`tests/qa-fixtures/get-well-soon.json`)
- **Program:** "Get well soon" — `cmp21vqmp0001ita5yh8zk0kr`
- **Source videos:** 2 × Alexis Hawes Health (Everyday Health Hacks 225s, Macronutrients 226s)
- **Generator model:** `claude-sonnet-4-6` via `LLM_PROVIDER=anthropic`
- **Judge model:** `claude-opus-4-7` via `apps/web/scripts/qa-judge.ts`
- **DB:** QA Neon branch `ep-floral-moon-ahi2zriz` (isolated from prod)

## Judge result

**Overall: 3.88 / pass** (threshold ≥3.5 + faithfulness ≥4 + topic ≥4)

| Dimension | Score |
|---|---|
| Lesson Boundaries | 3/5 |
| Lesson Count Appropriateness | 4/5 |
| Title Clarity | 4/5 |
| Step Logical Flow | 3/5 |
| Source Faithfulness | 5/5 |
| Topic Boundary Respect | 4/5 |

Full report: [judgement.md](./get-well-soon/judgement.md). Raw inputs: [inputs.json](./get-well-soon/inputs.json). Score JSON: [scores.json](./get-well-soon/scores.json).

## Bugs identified

1. **Emergency-fill clip splitter uses arithmetic halving** — clip boundaries placed at `videoDuration / N` (e.g., 113s on a 226s video) instead of snapping to `analysis.segments` boundaries. Lesson 2/4 cut at 113s should be at 143s (carbs→protein segment edge). ClickUp: [86e1b7b8f](https://app.clickup.com/t/86e1b7b8f)
2. **Lesson titles under-promise content** — Lesson 3 promises 3 hacks; assigned clip 112–225s contains 7. Likely a side-effect of #1 (titles generated before emergency-fill modifies boundaries) — verify before treating as standalone. ClickUp: [86e1b7b92](https://app.clickup.com/t/86e1b7b92)
3. **No WATCH step in generated curricula** — every session has SessionClip records but only DO/REFLECT step types. Unclear if by design (clips render via a different UI element) or a generator regression. ClickUp: [86e1b7b9m](https://app.clickup.com/t/86e1b7b9m)

## Architectural finding

The clip-distributor was introduced in commit `c76b6e6` (2026-04-07, "feat: overhaul AI generation pipeline with Gemini provider and clip distribution") with a deliberate split of responsibilities:

- **`analysis.topics` → where to cut** (clip boundaries, thematic grouping)
- **`analysis.segments` → what text to ground the LLM with** (per-clip transcript excerpts injected into the prompt)

Segments are never consulted as candidate cut points today. The emergency-fill path bypasses both. The fix in Ticket #1 is to *extend* the existing model — add segment-snap to the fallback path — rather than reorganize the topics/segments roles. Worth reading commit c76b6e6 in full before doing anything larger (e.g., Option B — hybrid topic-from-segments — would benefit from that architectural fluency).

## Calibration debt — read this before running more fixtures

**The 3.88 pass verdict is not yet trustworthy.** The judge's rubric thresholds (≥3.5 overall, ≥4 on faithfulness and topic-respect) are uncalibrated against your own taste. They're reasonable defaults, but until you've personally read a couple of judgements and decided whether you agree with the scores, "passing" doesn't mean "shippable."

**Resist the urge to add many fixtures first.** The natural tomorrow-instinct is "let me see if other programs pass." Don't. The right order is:

1. Fix Ticket #1, re-run the **same** fixture, confirm Topic Boundary Respect moves to 5/5
2. Read the new judgement.md by hand — do you agree it's better?
3. Once #2 feels true, *then* add a 15+ min single-video fixture to confirm the bugs aren't short-video-specific
4. Only after the harness gives you results you trust on 2 fixtures should you scale to a broader set

The fixture count is a vanity metric until the signal is calibrated.

## Recommended next steps (in order)

1. Read commit `c76b6e6` for architectural intent
2. Verify generation-order question in Ticket #2 (does `validateAndFixClipDistribution` run before or after title generation?) — this either dissolves Ticket #2 or makes it standalone
3. Implement Ticket #1 (segment-snap in emergency-fill, ~30 LOC)
4. Re-run `pnpm tsx apps/web/scripts/qa-judge.ts --fixture get-well-soon` — verify Lesson 2/4 lands at 143s and Topic Boundary Respect ↑ to 5
5. Read the new judgement.md — calibrate
6. Add a 15+ min single-video fixture (`tests/qa-fixtures/<name>.json`) and run
7. Decide on Ticket #3 (WATCH step) based on UI/intent check

## Session win

Started the evening looking for a file uncertain you'd written. Ended with: working QA harness, prod-isolated Neon branch, Anthropic timeout bug found (and fixed locally — bump `GENERATION_TIMEOUT_MS` from 120s to 600s in `packages/ai/src/llm-adapter.ts:22`), three real bugs identified with traceable root causes, and an architectural understanding of how the pipeline consumes Gemini data. Don't lose it.
