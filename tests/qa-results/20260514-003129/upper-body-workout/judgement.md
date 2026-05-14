# Curriculum Judgement: Upper body workout

## Summary
The curriculum reorganizes two demonstration workout videos into a four-lesson chest-and-triceps program with a reasonable pedagogical arc (free weights → machines/cables → finishers → triceps). However, several clip boundaries straddle Gemini's segment boundaries, the program description is empty, and Lesson 4's title and clips claim coverage of "bench dips and cable rope pushdowns" but the clip window actually includes a third exercise (Dumbbell Triceps Kickback) that goes unmentioned.

## Scores

### Lesson Boundaries: 3/5
The macro structure (free weights / machines / finishers / triceps) is defensible, but Lesson 3 awkwardly splits Video A's single contiguous routine — Bench Push-Up and Decline Cable Crossover are pulled out of Video A while the first three Video A exercises sit in Lesson 1. This fragments a single Gemini topic ("Chest and Triceps Workout Routine," 0–1231) across two non-adjacent lessons.

### Lesson Count Appropriateness: 4/5
Four lessons is reasonable for ~49 minutes of exercise demos across 12 distinct movements. Lessons 1 and 3 could arguably merge (both are Video A chest work), but the split is defensible as "foundational vs. finisher."

### Title Clarity: 4/5
Titles are specific and action-oriented (e.g., "Master the flat press and dumbbell fly to load your chest from two angles"). Lesson 4's title ("bench dips and cable rope pushdowns") is inaccurate because the clip also includes Dumbbell Triceps Kickback (1506–1702), which is omitted from the title and summary.

### Step Logical Flow: 3/5
Every lesson is a DO + REFLECT pair with no WATCH or PRACTICE differentiation, which is thin given there is no spoken instruction in either source video — learners are asked to "perform exactly as demonstrated" without a setup step. Flow is acceptable but formulaic.

### Source Faithfulness: 4/5
Exercise names, set/rep schemes (3×10, 60s rest), and durations all trace to the source. One minor embellishment: Lesson 4's summary calls dips and pushdowns "the complete triceps block from Workout B," but Workout B's triceps block actually has three exercises (the kickback is in the clip range but ignored in the narrative). Also, the program targets "shoulders and chest" but no shoulder content exists in either source.

### Topic Boundary Respect: 2/5
Multiple clips straddle Gemini segment boundaries:
- Lesson 1, clip 1: `0–410` straddles the Flat Bench Dumbbell Press segment (ends at 267) and bleeds 143s into Dumbbell Flyes.
- Lesson 1, clip 2: `410–794` starts mid-Dumbbell-Flyes (segment is 267–542) and extends through all of Low Pulley Cable Fly (542–794), which Lesson 1 doesn't mention.
- Lesson 3, clip: `794–1231` correctly covers Bench Push-Up (794–1033) and Decline Cable Crossover (1033–1231) — clean.
- Lesson 2, clip: `0–1024` matches the "Chest Exercises" topic exactly — clean.
- Lesson 4, clip: `1024–1702` matches the "Triceps Exercises" topic exactly, but the lesson narrative ignores the kickback subtopic.

Lesson 1's clips clearly fight the Gemini segmentation and also misrepresent which exercises are covered (Low Pulley Cable Fly is inside the clip range but unmentioned).

## Recommendations
- Re-cut Lesson 1's clips to honor segment boundaries: `0–267` for the Press and `267–542` for the Flyes; move Low Pulley Cable Fly into its own step or a separate lesson rather than burying it inside a "press and flyes" clip.
- Fix Lesson 4's title and summary to include Dumbbell Triceps Kickback (1506–1702), or shorten the clip to `1024–1506` if the intent was truly only two exercises.
- Either remove "shoulders" from the `targetTransformation` or add shoulder source material — the current promise is unsupported.
- Populate `programDescription` (currently empty).
- Consider adding a WATCH step before each DO so learners orient to the demonstration before attempting the movement, since neither video has spoken cueing.
