# Curriculum Judgement: Upper body workout

## Summary
This curriculum attempts to teach a chest-and-triceps workout but suffers from severe structural and faithfulness problems. Lesson 2 references an entirely different video ("Chest and Triceps A") that does not exist in the source material, and the lesson ordering fragments the chest portion of the B session across Lessons 1 and 4 with an unrelated detour in between. The pipeline largely ignores the Gemini topic structure.

## Scores

### Lesson Boundaries: 2/5
The chest portion of the B session is split across Lesson 1 (first two chest exercises) and Lesson 4 (last two chest exercises), with Lessons 2 (a different workout entirely) and 3 (triceps) inserted between them. This is a major boundary violation — the Gemini `topics` array clearly defines "Chest Exercises" (0–1024s) as a single coherent unit.

### Lesson Count Appropriateness: 3/5
Four lessons is plausible for seven exercises, but the inclusion of a fabricated "Chest and Triceps A" lesson inflates the count artificially. Three lessons (chest part 1, chest part 2, triceps) would match the source better.

### Title Clarity: 4/5
Titles are specific and action-oriented (e.g., "Build triceps strength with Bench Dips and Cable Rope Pushdowns"). However, "Complete the full Chest A workout from start to finish" promises content that does not exist in the provided source.

### Step Logical Flow: 3/5
Each lesson has a simple DO → REFLECT pattern which is coherent within a lesson, but the cross-lesson progression is broken: finishing the chest portion (Lesson 4) after doing triceps (Lesson 3) is backward relative to the source video's actual order.

### Source Faithfulness: 1/5
Lesson 2 references `videoId: "cmp4tzbsx0012itazx5g1w393"` and a "Chest and Triceps A" session that is **not present in the provided source material**. The single source video is "Chest and Triceps B." The program title "Upper body workout" and the target transformation "Build shoulders and chest that actually show" also drift — the source contains no shoulder content. This is significant hallucination.

### Topic Boundary Respect: 2/5
Multiple violations against the Gemini `topics` array:
- Lesson 1's clip spans 0–510s, which is within the "Chest Exercises" topic (0–1024) — acceptable.
- Lesson 3's second clip runs 1267–1702s and the first runs 1024–1502s. These **overlap each other** (1267–1502 is double-covered), which is a clip-distributor failure.
- Lesson 2's clip points to a videoId not in the source at all — the bin-packer had no topic data to respect.
- The chest topic (0–1024) is fragmented across Lessons 1 and 4 with unrelated content between them, violating the spirit of the topic grouping.

## Recommendations
- Remove Lesson 2 entirely — it references a video not in the source. If a second workout is intended, it must come from an actual source payload.
- Reorder so all four chest exercises are covered before triceps, matching the Gemini "Chest Exercises" (0–1024) → "Triceps Exercises" (1024–1702) topic structure.
- Fix the overlapping clips in Lesson 3: Bench Dips should end at 1267 (not 1502), and Cable Rope Pushdown should run 1267–1506, with Dumbbell Triceps Kickback (1506–1702) added as a third clip.
- Align the program title and target transformation with the actual source ("Chest and Triceps B workout") — drop the shoulders reference.
- Add the missing Dumbbell Triceps Kickback exercise, which appears in the source `topics` but is absent from the curriculum.
