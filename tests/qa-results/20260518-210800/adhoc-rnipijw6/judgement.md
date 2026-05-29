# Curriculum Judgement: Box and Flow

## Summary
This curriculum cleanly interleaves boxing technique with yoga flow fundamentals across six lessons, alternating between the two Box and Flow videos and the dedicated yoga video. Lesson boundaries align well with Gemini's topic structure, and clip timestamps respect topic boundaries with one notable exception in Lesson 2. The titles and summaries are concrete and source-faithful, with no detected hallucination.

## Scores

### Lesson Boundaries: 5/5
Boundaries map almost perfectly onto Gemini topic structure. Lesson 1 covers the "Boxing Fundamentals & Punches" topic (0–526s) and Lesson 3 covers "Defense & Combinations" (526–805s) from the Dani video — an exact match. Lessons 5 and 6 split the Olivia boxing video at 415s, which is the natural seam between defense/fundamentals and the speed/combinations work.

### Lesson Count Appropriateness: 4/5
Six lessons is reasonable for three source videos of substantial length. The alternating boxing/yoga structure is pedagogically sound. One concern: Lessons 1 and 5 cover largely overlapping material (the four punches plus stance), which could feel redundant to a learner — though the "refinement" framing helps justify the second pass.

### Title Clarity: 5/5
Titles are consistently specific and action-oriented. "Throw your first four punches with correct form and full extension" and "Open your hips and spine with Chair, Warrior 2, Side Angle, and Low Lunge Twist" tell the learner exactly what's inside. Chapter titles enumerate the specific moves rather than using generic labels.

### Step Logical Flow: 4/5
Every lesson follows a clean DO → REFLECT progression after the (implicit) WATCH from clips. The steps are minimal — just one DO and one REFLECT per lesson — which is acceptable but lean; a learner gets one practice prompt per ~7–13 minute clip. Lesson 6's "3-minute combination round" is a strong, specific DO prompt.

### Source Faithfulness: 5/5
Every specific claim traces to the source. Dani's name, Olivia Young, the 90-degree elbow on hooks, "pulling a rope into your belly" for uppercuts, the jab-cross-slip-cross combo, Warrior 1/2, Side Angle, Low Lunge Twist, "flow through the fight" — all verified in the transcripts. The "audible exhale on every punch" cue in Lesson 6's DO step is directly from Olivia's "Breathing Technique" segment.

### Topic Boundary Respect: 4/5
Most clips align cleanly with Gemini topics. Lesson 1's clip (0–526s of Dani's video) exactly matches the "Boxing Fundamentals & Punches" topic. Lesson 3's clip (526–805s) exactly matches "Defense & Combinations." Lessons 5 and 6 split the Olivia boxing video, which has only one top-level topic spanning 0–802s, so any split is defensible — and the 415s breakpoint falls at the natural Gemini segment boundary between "Defense: The Weave" (ends 415s) and "Speed Drills" (starts 415s). **The one violation:** Lesson 2's clip ends at 437s, which is mid-yoga-video. The yoga video has only one top-level topic (0–766s), so this is structurally fine, but Lesson 4's clip ends at 766s while the video's `durationSeconds` is 1246 — meaning roughly 480 seconds of source content (Boat pose, Bridge/Wheel, Half Pigeon, Savasana) is completely omitted from the curriculum despite being substantive material flagged in `keyMoments`.

## Recommendations
- Add a seventh lesson covering the omitted yoga material (Boat pose, Bridge/Wheel, Half Pigeon, Savasana) from 766s–1246s of the yoga video — this is high-significance content per Gemini's `keyMoments` and includes the thematic Savasana/"flow through the fight" insight.
- Expand each lesson's step list beyond one DO + one REFLECT; a 7–13 minute clip can support 2–3 distinct practice prompts (e.g., separate jab drill, cross drill, and jab-cross combo prompts in Lesson 1).
- Address the Lesson 1 / Lesson 5 overlap explicitly in Lesson 5's summary — make clear this is a *refinement* pass with new cues, not a repeat.
- Consider whether the alternating boxing/yoga ordering serves the learner; a Box and Flow class integrates them, so consecutive boxing lessons followed by consecutive yoga lessons may not reflect the actual practice structure.
- The `programDescription` field is empty — fill it in to give learners context before they commit to the program.
