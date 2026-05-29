# Curriculum Judgement: Box and flow

## Summary
The curriculum reasonably structures a Box and Flow program from three source videos, sequencing yoga fundamentals first and boxing techniques second. However, several clip timestamps extend well beyond the source video durations, and lesson 4 fragments the Gemini "Core, Backbends, and Cool Down" topic with end timestamps far past the video's actual length (766s). The yoga lessons also straddle the two Gemini topic boundaries at 489s.

## Scores

### Lesson Boundaries: 3/5
Lessons 1–3 all sit within Gemini's "Yoga Flow Fundamentals" topic (0–489s), and Lesson 4 covers "Core, Backbends, and Cool Down" — a clean topic-aligned split conceptually. However, Lesson 3's clip ends at 810s, which crosses the 489s topic boundary and bleeds into the cool-down content. Lessons 5 and 6 cleanly correspond to the two boxing videos.

### Lesson Count Appropriateness: 4/5
Six lessons across three videos (4 yoga + 2 boxing) is reasonable given the density of the yoga video and the parallel coverage of the two boxing videos. Lesson 6 arguably duplicates Lesson 5's content rather than extending it, since both source videos cover the same stance/jab/cross material.

### Title Clarity: 4/5
Titles are specific and action-oriented — e.g., "Build your boxing stance, land your jab, and deliver your first cross" and "Open your hips and twist deeper with Warrior Two and low lunge" tell the learner exactly what's inside. "Lock in your mechanics with a second coach" is slightly awkward but still concrete.

### Step Logical Flow: 3/5
Each lesson has only a DO step and a REFLECT step (no dedicated PRACTICE or distinct progression within steps). The clips function as the WATCH, which is fine per the rubric, but the DO→REFLECT pattern is minimal and repetitive across all six lessons rather than showing pedagogical variation.

### Source Faithfulness: 4/5
Most details trace to the source: "left foot 12 o'clock, right foot 3 o'clock," "pouring out a cup of coffee," "no T-Rex arms," front knee 90°, back heel down — all verifiable. Minor issue: Lesson 6's claim that Dani covers "combination work" and "combining both punches into flowing sequences" overstates the source — Dani's transcript ends mid-cross instruction at 325s and never reaches combinations.

### Topic Boundary Respect: 2/5
Multiple serious violations. The yoga video's `durationSeconds` is 766, but clips extend to 810s (Lesson 3) and 1246s (Lesson 4) — these timestamps don't exist in the source. Lesson 3's clip (437–810s) straddles the Gemini topic boundary at 489s, crossing from "Yoga Flow Fundamentals" into "Core, Backbends, and Cool Down." Lesson 4's clip (810–1246s) is entirely outside the video's actual runtime. Lesson 1's clip ends at 231s (within Yoga Flow Fundamentals — clean). Lesson 2's clip (231–437s) is clean. Boxing lesson clips (5 and 6) align perfectly with their single-topic source videos.

## Recommendations
- Fix clip timestamps in Lessons 3 and 4 — Lesson 3 should end at 489s (the Gemini topic boundary), and Lesson 4 should run 490–766s, not 810–1246s.
- Split Lesson 3's clip so it does not cross the 489s boundary between "Yoga Flow Fundamentals" and "Core, Backbends, and Cool Down."
- Either merge Lessons 5 and 6 (since both source videos cover the same stance/jab/cross territory) or give Lesson 6 a genuinely distinct framing, such as a comparison/contrast drill.
- Soften Lesson 6's summary to remove the claim that Dani teaches "combinations" — her transcript cuts off during the cross explanation.
- Add a distinct PRACTICE or progression step within at least one lesson rather than repeating DO + REFLECT across all six.
