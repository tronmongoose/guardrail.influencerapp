# Curriculum Judgement: Upper body workout

## Summary
The curriculum decomposes two workout videos into four lessons that mostly respect the exercise structure of the source. However, the lesson sequencing splits Video A awkwardly across Lessons 1 and 3 (with Video B's Lesson 2 inserted between them), and Lesson 4 silently drops the Dumbbell Triceps Kickback exercise that appears in the source. Clip boundaries also straddle Gemini's segment boundaries in several places.

## Scores

### Lesson Boundaries: 3/5
Lesson 2 (entire chest portion of Video B) and Lesson 4 (triceps portion of Video B) cleanly map to Gemini's two topics in Video B. However, Video A is split into Lesson 1 (exercises 1–2) and Lesson 3 (exercises 4–5), with Lesson 2 from a different video wedged between them — this is a confusing ordering and Lesson 3 also drops Low Pulley Cable Fly (exercise 3) entirely from Video A.

### Lesson Count Appropriateness: 3/5
Four lessons for 12 distinct exercises across two videos is defensible, but the asymmetry is jarring: Lesson 1 covers 2 exercises (~14 min), Lesson 2 covers 4 exercises (~17 min), Lesson 3 covers 2 exercises (~7 min), and Lesson 4 covers only 2 of the 3 triceps exercises. The Dumbbell Triceps Kickback (1506–1702) is omitted with no justification.

### Title Clarity: 4/5
Titles are specific and action-oriented, e.g., "Press and fly your chest with dumbbells using correct form on every set" and "Isolate and exhaust your triceps with Bench Dips and Cable Rope Pushdowns." The Lesson 4 title is misleading though — it promises bench dips and pushdowns but the clip range (1024–1702) includes the kickback exercise too, which isn't mentioned anywhere.

### Step Logical Flow: 3/5
Every lesson follows the same minimal two-step DO → REFLECT pattern, which is coherent but extremely thin. There's no WATCH step despite these being demonstration-heavy videos with no dialogue, and no progressive build within lessons — just "do it, then reflect."

### Source Faithfulness: 3/5
Most exercise names, set/rep schemes, and rest intervals match the source. But there are notable issues: (1) the program description claims "Build shoulders and chest" — shoulders are not in either source video; (2) Lesson 4's clip spans 1024–1702 and is titled around only two exercises, ignoring the Dumbbell Triceps Kickback that Gemini explicitly identifies at 1506–1702; (3) Lesson 3's summary calls itself completing "Chest and Triceps A" but Video A is titled chest and triceps yet contains zero triceps exercises per the segments — so calling it a "full chest routine" while the title implies triceps is a faithfulness blur.

### Topic Boundary Respect: 2/5
Multiple clips straddle Gemini segment boundaries. Lesson 1's first clip is 0–410, but Gemini's Flat Bench Dumbbell Press segment ends at 267 — so 267–410 silently includes Dumbbell Flyes. Lesson 1's second clip 410–821 overshoots the Dumbbell Flyes segment (ends at 542) by ~280 seconds, swallowing the entire Low Pulley Cable Fly segment without acknowledgment. Lesson 3's clip 821–1231 starts mid-way through Low Pulley Cable Fly (ends 794) and Bench Push-Up (starts 794, ends 1033), then continues into Decline Cable Crossover — so it's split incorrectly. Video B's clips (0–1024 and 1024–1702) align cleanly with Gemini's two macro-topics, but the curriculum is essentially ignoring the finer subtopic granularity that Gemini provided.

## Recommendations
- Re-bin clips to respect Gemini's segment boundaries: Flat Bench Dumbbell Press ends at 267, not 410; Dumbbell Flyes ends at 542, not 821.
- Either include the Dumbbell Triceps Kickback (1506–1702) as a third exercise in Lesson 4 or trim the clip to 1024–1506 — don't silently include footage the lesson doesn't reference.
- Re-order lessons so Video A's content is contiguous (Lessons 1+3 should merge or sit adjacent), not interrupted by Video B.
- Remove "shoulders" from the targetTransformation — neither source video covers shoulders.
- Add a WATCH step before DO in each session, since the source videos are demonstration-only with no dialogue; learners need to observe form before executing.
