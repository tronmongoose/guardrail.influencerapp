# Curriculum Judgement: Get well soon

## Summary
The curriculum produces two thematically coherent lessons that map cleanly onto the two source videos, with reasonable titles and faithful content. However, it is severely under-segmented — each lesson contains a single session with one giant clip spanning the entire video, which collapses 10 distinct hacks and 4 distinct macronutrient topics into monolithic chunks. The program title and transformation statement are also generic/off-tone.

## Scores

### Lesson Boundaries: 4/5
The two-lesson split cleanly separates the "health hacks" video from the "macronutrients" video, which is a natural topical boundary. No lesson straddles unrelated source material.

### Lesson Count Appropriateness: 3/5
Two lessons for two videos is defensible at the lesson level, but the source clearly contains 10 distinct hacks and 4 distinct macronutrient concepts (plus bio-individuality) — the curriculum collapses all of this into 2 sessions with no internal segmentation. The Gemini `segments` array literally provides 6 natural sub-chunks for video 1 and 5 for video 2, which the generator ignored.

### Title Clarity: 3/5
Lesson titles are specific and action-oriented (e.g., "Choose your food with intention by understanding what carbs, protein, and fat actually do"). However, the `programTitle` "Get well soon" is generic/glib, `programDescription` is empty, and `targetTransformation` ("Rewire your brain. Stop fighting yourself.") is disconnected from the actual content about health hacks and macros.

### Step Logical Flow: 3/5
Each session has only a DO and a REFLECT step — there is no WATCH step or setup/concept progression. The flow is acceptable but minimal; learners are asked to "test two hacks back-to-back" without any guided introduction step preceding the action.

### Source Faithfulness: 5/5
Every specific claim in the lesson summaries traces back to the source: "twice the amount of protein... only half the amount of fiber," the 20-20-20 rule framing, unsaturated vs. saturated/trans fats, bio-individuality factors (activity level, genetics, health goals). No hallucinated facts, names, or examples.

### Topic Boundary Respect: 2/5
Each `SessionClip` spans the entire video (0–225 for video 1, 0–226 for video 2). While these clips technically fall within the single top-level `topics` entry for each video (each source has only one top-level topic with subtopics), the clip distributor's purpose is to honor sub-structure — and the `segments` array provides 6 and 5 natural sub-boundaries respectively that are completely ignored. Additionally, the chapterTitle "Hacks 1–5: Blood sugar, hydration, eyes, cold showers, and morning light" is misleading because the clip actually covers all 10 hacks (0–225s), not just hacks 1–5.

## Recommendations
- Split Lesson 1 into multiple sessions or steps, each anchored to 2–3 specific hacks with tight clip ranges (e.g., 0–114s, 114–146s, 146–216s, 216–253s) drawn from the `segments` array.
- Split Lesson 2 into separate sessions for carbs (35–143s), protein (143–217s), fats (217–322s), and bio-individuality (322s–end).
- Fix the misleading `chapterTitle` "Hacks 1–5..." — it claims a subset but the clip covers the full video.
- Replace the generic `programTitle` "Get well soon" and the off-topic `targetTransformation` "Rewire your brain. Stop fighting yourself." with content-specific framing about everyday health habits and macronutrient literacy. Fill in the empty `programDescription`.
- Add a WATCH step to each session so learners are guided into the clip before the DO/REFLECT steps.
