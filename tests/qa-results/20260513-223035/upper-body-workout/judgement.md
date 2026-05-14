# Curriculum Judgement: Upper body workout

## Summary
The curriculum builds a reasonable 4-lesson chest-and-triceps program from two source videos, with lesson structure that mostly tracks the Gemini topic boundaries. However, the lesson sequencing interleaves the two videos awkwardly (Video A → Video B → back to Video A → Video B), and one lesson title overstates "complete muscle fatigue" while the source has no spoken content to support pedagogical framing. The Dumbbell Triceps Kickback exercise from Video B is silently dropped from Lesson 4.

## Scores

### Lesson Boundaries: 3/5
Lesson 2 cleanly maps to the "Chest Exercises" topic in Video B (0–1024s), and Lesson 4 maps to the "Triceps Exercises" topic — both are clean boundary respects. However, Lesson 1 and Lesson 3 split Video A's single topic ("Chest and Triceps Workout Routine") arbitrarily, with Lesson 2 (Video B chest) wedged between them. A learner doing this in order would hop video A → B → A → B, which is incoherent.

### Lesson Count Appropriateness: 4/5
Four lessons for ~49 minutes of total content across 12 exercises is reasonable. Splitting Video A's chest work across Lessons 1 and 3 inflates the count slightly — a 3-lesson structure (Video A chest, Video B chest, Video B triceps) would be tighter.

### Title Clarity: 4/5
Titles are concrete and action-oriented, e.g., "Press and fly your chest with dumbbells using correct set and rep structure" tells the learner exactly what's inside. "Finish your chest workout with push-ups and cable crossovers for complete muscle fatigue" is specific but the "complete muscle fatigue" framing is editorial and not source-supported.

### Step Logical Flow: 3/5
Every lesson follows the same DO → REFLECT pattern, which is acceptable but mechanical. There's no WATCH step despite WATCH being a canonical type, and the source is purely demonstration video — a WATCH step would be the most natural entry. The flow within each lesson is fine but homogenous across all four lessons.

### Source Faithfulness: 4/5
Exercise names, set/rep schemes (3×10), and 60-second rest intervals all trace cleanly to the segments and summaries. One omission worth flagging: Lesson 4's clip spans 1024–1702s and the lesson title/summary only mentions "Triceps Bench Dips and Cable Rope Pushdown" — the **Dumbbell Triceps Kickback** (1506–1702s, a Gemini-identified topic) is in the clip range but absent from the lesson narrative. Also, "Build shoulders and chest that actually show" mentions shoulders, but no shoulder work exists in either source video — minor hallucination in the targetTransformation field.

### Topic Boundary Respect: 3/5
Lesson 2's clip (Video B, 0–1024s) exactly matches the "Chest Exercises" topic (0–1024s) — perfect alignment. Lesson 4's clip (1024–1702s) matches the "Triceps Exercises" topic (1024–1702s) — also clean. However, Video A has only one topic spanning 0–1231s, and the curriculum splits it across Lesson 1 (0–410s) and Lesson 3 (821–1231s), leaving a gap of 410–821s (the entire Low Pulley Cable Fly segment, 542–794s) **unassigned to any lesson**. Additionally, Lesson 1's clip ends at 410s mid-Dumbbell-Flyes segment (which runs to 542s) — that's a straddle of the Gemini-identified subtopic boundary.

## Recommendations
- Restructure to 3 lessons grouped by video: (1) Video A full chest workout, (2) Video B chest block, (3) Video B triceps block — this respects the natural video boundaries and avoids the A→B→A→B hop.
- Add the missing Low Pulley Cable Fly (Video A, 542–794s) and Dumbbell Triceps Kickback (Video B, 1506–1702s) coverage so no source segment is silently dropped.
- Fix Lesson 1's clip endpoint at 542s (end of Dumbbell Flyes segment) instead of 410s, which currently straddles the segment boundary.
- Remove "shoulders" from the targetTransformation since no shoulder exercises exist in the source.
- Add a WATCH step type to lessons so learners actually view the demonstration before logging a DO step — the source is silent demonstration video, which is the textbook WATCH use case.
