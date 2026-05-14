# Curriculum Judgement: Get well soon

## Summary
A serviceable two-lesson overlay on two short Alexis Hawes videos. Lesson structure cleanly mirrors the source's one-video-per-topic split, and content is faithful to the transcripts. The main weaknesses are a generic, off-tone program title/transformation, thin step design (no WATCH step despite the curriculum being clip-anchored), and one clip range in Lesson 1 that spans the entire video plus a redundant overlapping sub-clip.

## Scores

### Lesson Boundaries: 5/5
The two lessons map cleanly to the two source videos: Lesson 1 = "Everyday Health Hacks" video, Lesson 2 = "Macronutrients" video. No straddling, no unnatural splits.

### Lesson Count Appropriateness: 4/5
Two lessons for two distinct ~4-minute videos is defensible. One could argue the 10-hack video deserves to be split (e.g., morning routine vs. evening/sleep), but a single lesson is reasonable given the short runtime and the source's own "10 Everyday Health Hacks" single-topic framing.

### Title Clarity: 4/5
Lesson titles are specific and action-oriented (e.g., "Stop fearing carbs and fat — learn what your body actually needs from each macronutrient"). However, the *program* title "Get well soon" is generic/flippant and the `targetTransformation` "Rewire your brain. Stop fighting yourself." is unrelated to the actual content (health hacks + macronutrient literacy). Step titles are concrete.

### Step Logical Flow: 3/5
Each lesson has only DO + REFLECT — no WATCH step is explicitly defined, even though clips are attached. The DO-then-REFLECT order is fine, but for a clip-driven curriculum the absence of a WATCH/observe step before the DO feels like a missing rung. Flow is acceptable but skeletal.

### Source Faithfulness: 5/5
Every claim in the lesson summaries traces to the transcripts: 10-minute post-meal walks, oil pulling, 20-20-20 rule, "twice the protein / half the fiber" framing, fat-soluble vitamins, bio-individuality. No invented examples, names, or numbers. The program title and transformation are vague but not hallucinated facts.

### Topic Boundary Respect: 3/5
Lesson 2's three clips map cleanly onto Gemini segments: 0–143 (carbs intro), 143–217 (protein), 217–226 (fats + bio-individuality — note this clip actually merges two Gemini segments, "Fats" 217–322 and "Bio-individuality" 322–226, but the source's own endSeconds are inconsistent so this is defensible).

Lesson 1 is the problem: clip #1 is `0–225` — the **entire video** — and clip #2 is `216–225`, which sits *inside* clip #1 and is labeled "Oil Pulling, Portion Control, and Circulation" despite the source placing oil pulling at 216, sleep/portion through 253, and legs-up-the-wall at 253+. The single video-spanning clip ignores the six distinct Gemini segments (Intro, Walking/Water, Eye/Cold, Sunlight/Vinegar, Oil/Sleep/Portion, Legs/Conclusion) entirely. The bin-packing was effectively bypassed.

## Recommendations
- Replace the program title "Get well soon" and the off-topic transformation line with something tied to the actual content (e.g., "Small habits, real health: hacks and macros that actually work").
- Split Lesson 1's single 0–225 clip into 3–4 sub-clips aligned with the Gemini segments (e.g., 0–114 walking/water, 114–146 eye/cold, 146–216 sunlight/vinegar, 216–225 oil/sleep/portion/legs). The current overlap of 0–225 and 216–225 is redundant.
- Add an explicit WATCH step before the DO step in each lesson so the clip's role in the pedagogy is clear.
- Consider splitting Lesson 1 into a "Daytime hacks" / "Evening + sleep hacks" pair to better match the source's six segments and give learners a tighter habit stack per session.
- Tighten Lesson 2's final clip to honor the actual "Fats" (217–322) and "Bio-individuality" segments rather than the truncated 217–226 range.
