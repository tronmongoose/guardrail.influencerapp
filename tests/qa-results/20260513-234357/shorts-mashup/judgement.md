# Curriculum Judgement: Power yoga

## Summary
The curriculum is a well-organized 8-lesson yoga program built faithfully from 15 short tutorial videos, with clip boundaries that closely respect the Gemini-identified segments. The strongest aspects are source faithfulness and clean clip-to-segment alignment; the weakest is Lesson 1, which yokes together two unrelated standalone tutorials (Headstand and Warrior I) under a "foundation" framing the source material doesn't really support.

## Scores

### Lesson Boundaries: 3/5
Most lessons group thematically coherent poses (Lesson 4 inversions, Lesson 7 squats, Lesson 8 Warrior III standalone), but Lesson 1 pairs a headstand inversion with Warrior I — two unrelated tutorials that don't share a "foundation" thread beyond a generic "shoulder-width" callback. Lesson 2 similarly bolts Legs-Up-The-Wall (restorative) onto Warrior II and High Lunge (active standing) in a way that feels packaged rather than progressive.

### Lesson Count Appropriateness: 4/5
Eight lessons for 15 short tutorials is reasonable density — roughly two poses per lesson with a few solo features. The standalone Warrior III lesson (Lesson 8) is arguably thin (only 85 seconds of source) and could have been merged with the lunge family in Lesson 2.

### Title Clarity: 5/5
Titles are consistently specific and action-oriented: "Open your hips and heart with Camel Pose and Humble Warrior," "Go upside down safely with Forearm Stand and Crow Pose," "Build leg power through all three squat levels." A learner skimming would know exactly what's inside each lesson.

### Step Logical Flow: 3/5
Every session has exactly one DO and one REFLECT step, which is formulaic rather than pedagogically progressive. There's no WATCH step despite the rubric naming it as a step type, and no scaffolded build (e.g., setup → practice → integration). The flow is acceptable but mechanical.

### Source Faithfulness: 5/5
Every specific detail traces back to the source: "railroad tracks" and "headlights" (Warrior I), "bicycle seat" (High Lunge), "flying arms" (Revolved Chair), block heights for Bridge, two blocks 18 inches apart for Crow, "equal and opposite" for Warrior III, "kick back to go forward." No invented examples, names, or claims. The program description is empty, which is a minor gap but not a hallucination.

### Topic Boundary Respect: 5/5
Clip timestamps map cleanly onto Gemini's `segments` (the de facto topic structure, since each video has a single top-level `topic`). E.g., Headstand clips at 0–34, 34–104, 104–131, 131–204 exactly match the four segments. Warrior II clips at 0–36, 36–51, 51–92 align with segment boundaries (0–36, 36–51, 51–92). Tree Pose clips at 0–29, 29–58, 58–142, 142–204 mirror the four segments precisely. No clip straddles a Gemini-identified boundary.

## Recommendations
- Split Lesson 1: give Headstand its own slot or pair it with Forearm Stand/Crow in Lesson 4 (true inversion family); pair Warrior I with the other warriors in Lesson 2.
- Move Legs-Up-The-Wall to a closing recovery lesson or pair it with Modified Bridge (both supine/restorative) rather than after active lunges.
- Add a WATCH step before DO in each session so learners orient before practicing; the DO/REFLECT-only pattern feels truncated.
- Fill in `programDescription` — currently empty, which weakens the program-level framing.
- Consider merging Lesson 8 (Warrior III, 85 sec of source) into the warrior family to avoid a thin standalone lesson.
