# Curriculum Judgement: workout like a champ

## Summary
This curriculum stitches together four unrelated workout videos (chest/triceps, standing abs, mobility, legs) into an 8-lesson program with an ordering that is genuinely confusing — chest fly is taught in Lesson 1, then mobility, then chest press/cable fly in Lesson 3, then the final chest exercise (decline crossover) in Lesson 8. Clip-to-topic mapping is mostly clean against the Gemini `topics` arrays, but the overall lesson sequencing actively fights the source structure. Source faithfulness is solid: claims trace back to transcripts.

## Scores

### Lesson Boundaries: 2/5
Boundaries split a single Gemini topic ("Chest Exercises", which contains 4 sequential exercises) across Lessons 1, 3, and 8 in non-sequential order. The chest block is fragmented and interleaved with unrelated mobility/abs/legs content, so a learner finishing Lesson 1 (Chest Fly) then jumps to mobility, then back to the *earlier* chest exercises — boundaries feel arbitrary rather than topic-driven.

### Lesson Count Appropriateness: 3/5
Eight lessons across four short workouts is defensible, but the chest workout is needlessly fragmented into three separate lessons (1, 3, 8) when the Gemini `topics` array bundles it as a single "Chest Exercises" topic. Triceps is split into two lessons (5, 7) that even overlap — Cable Rope Pushdown appears in both.

### Title Clarity: 4/5
Titles are concrete and action-oriented (e.g., "Open every major joint with the five-move mobility sequence", "Isolate and fatigue the triceps with Bench Dips and Cable Rope Pushdowns"). One issue: Lesson 8's title promises learners will "own your full-session pacing" but the lesson is just one exercise — the title overpromises.

### Step Logical Flow: 2/5
Every lesson uses the same two-step DO → REFLECT pattern with no WATCH or PRACTICE steps, despite the rubric naming those types. There's no setup/concept/application progression; lessons are essentially "do the clip, then reflect." Lesson 8's DO step ("Write the complete chest and triceps exercise order from memory") is disconnected from actually performing the Decline Cable Crossover.

### Source Faithfulness: 4/5
Exercise names, set/rep schemes (3x10, 60-second rest), coaching cues, and host names (Joey Thurman) all trace cleanly to the source. Minor embellishment: the programDescription/transformation "Build bulletproof strength in half the time" is generic marketing not grounded in any source. The Lesson 2 chapter title "Intro, 90/90 Hip Floss, and Cat/Camel" undersells a clip that actually spans all five mobility exercises (0–501s).

### Topic Boundary Respect: 3/5
Most clips align cleanly with Gemini topics: Lesson 1's clip (510–775) sits exactly inside the Machine Chest Fly segment; Lesson 3's clips (0–258, 258–510) match Machine Chest Press and Low Pulley Cable Fly segment boundaries precisely; Lesson 8's clip (775–1024) matches Decline Cable Crossover exactly. However, **Lesson 5's clip 1267–1363 and Lesson 7's clip 1363–1506 split the Cable Rope Pushdown segment (1267–1506) arbitrarily across two lessons** — that's a clear topic-boundary violation, splitting one Gemini-identified exercise into two halves placed in different lessons. Also, Lesson 6's clip (0–290) for the leg workout spans three Gemini topics (Abductions, Lunges, Squats) but is titled only "Single Leg Abductions," misrepresenting the topic content.

## Recommendations
- **Re-sequence the chest block.** Group Lessons 1, 3, and 8 into a single contiguous chest sequence (Press → Cable Fly → Chest Fly → Decline Crossover) matching the Gemini `topics` order, rather than scattering them across the program.
- **Fix the Cable Rope Pushdown split.** The segment runs 1267–1506; do not split it at 1363 across Lessons 5 and 7. Put the full pushdown in one lesson.
- **Use the full step type vocabulary.** Introduce WATCH steps before DO and use PRACTICE where appropriate — every lesson currently collapses to DO + REFLECT, which is pedagogically thin.
- **Match chapter titles to clip span.** Lesson 2's clip covers all five mobility moves; the chapter title should reflect that. Same fix for Lesson 6's leg clip.
- **Decide whether to merge these four videos at all.** The source material is four standalone workouts; a more honest curriculum might be four lessons (one per video) rather than eight cross-cut lessons that obscure each workout's internal arc.
