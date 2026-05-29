# Curriculum Judgement: 9th Degree

## Summary
The curriculum maps three source videos onto three lessons with sensible thematic alignment, and lesson titles are concrete and action-oriented. However, the program suffers from extreme under-segmentation within lessons (one giant clip per lesson rather than respecting Gemini's subtopic structure), a clip in Lesson 3 that ends at 215s and omits the Throat, Third Eye, and Crown chakras despite the lesson title promising "all seven," and a chapter title in Lesson 3 that explicitly lists only four of the seven chakras.

## Scores

### Lesson Boundaries: 4/5
The three lessons cleanly correspond to the three source videos and the topical breaks between them are natural (grounding techniques → polarity testing/reset → chakra map). No lesson straddles unrelated source material.

### Lesson Count Appropriateness: 3/5
Three lessons for three videos is defensible, but Lesson 1 collapses ~7 distinct techniques (K27, spleen, shoulder drag, cross crawl, crown pull, zip-up, hook-up, Cook's posture, steeple) into a single session with one clip. Given the source's clear per-technique segmentation, this is under-segmented — at minimum the grounding video warranted multiple sessions or per-technique chapter markers.

### Title Clarity: 4/5
Lesson titles are specific and outcome-oriented (e.g., "Test your energetic polarity and reset it with Cook's Crossover," "Map all seven chakras to your body so you can recognize imbalance by its symptoms"). The program title "9th Degree" is odd given the source brand is "Nth Degree," and `programDescription` is empty.

### Step Logical Flow: 4/5
Each session follows a clean DO → REFLECT pattern, which works for a kinesthetic/embodied curriculum. Flow is consistent across lessons, though the absence of any preparatory/conceptual step before DO in Lesson 2 (where conceptual framing of polarity matters) is a minor weakness.

### Source Faithfulness: 3/5
Most content traces back faithfully. However, Lesson 3's chapter title claims a "Complete Tour of the Root, Sacral, Solar Plexus, and Heart Chakras" while the lesson summary and title promise **all seven** chakras — and the clip endSeconds of 215 matches the Gemini `topics` endSeconds (which is itself wrong; the transcript clearly extends to 335s covering Throat, Third Eye, and Crown). The curriculum inherited the upstream truncation but then wrote a lesson summary promising content the clip doesn't deliver. That mismatch between promise and delivered clip is a faithfulness problem.

### Topic Boundary Respect: 2/5
This is the weakest dimension. 
- **Lesson 1**: A single clip 0–406 spans the entire video, ignoring the rich per-technique segment structure (10 segments) entirely. The source `topics` array only has one top-level topic, so technically the clip stays within it, but the lesson collapses every subtopic into one undifferentiated chapter.
- **Lesson 2**: Cleanly splits at 299s, which exactly matches the boundary between the two source `topics` ("Checking Your Polarity" 0–299 and "Resetting Polarity with Cook's Crossover" 299–541). This is exemplary.
- **Lesson 3**: Clip ends at 215s, matching the (incorrect) topic endSeconds, but the lesson promises seven chakras and the clip only covers four. The curriculum should have either trusted the transcript (to 335s) or honestly scoped the lesson to four chakras.

Net: Lesson 2 is a 5, Lesson 1 is a 2, Lesson 3 is a 2.

## Recommendations
- Split Lesson 1 into per-technique chapter markers within the clip (K27 0–50, Spleen 50–88, Shoulder Drag 88–123, Cross Crawl 123–140, Crown Pull 140–196, Zip-Up 196–219, Hook-Up 219–260, Cook's Posture 260–364, Steeple 364–406) or break into 2–3 sessions to honor the segment structure.
- Fix Lesson 3: either extend the clip endSeconds to 335 (the true transcript end) so all seven chakras are covered, or rewrite the lesson title/summary to honestly scope to the four chakras actually in the clip.
- Correct the chapter title in Lesson 3, which currently contradicts the lesson summary by listing only four chakras.
- Fill in `programDescription` and reconsider the program title "9th Degree" — the source brand is consistently "Nth Degree Healing."
- Add a brief WATCH-anchored conceptual step in Lesson 2 before the DO, since polarity is conceptually denser than the kinesthetic Lesson 1.
