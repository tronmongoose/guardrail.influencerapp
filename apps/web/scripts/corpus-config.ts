/**
 * Corpus config for the YouTube fixture harness.
 *
 * 30-video diversity corpus across 5 duration tiers and 10 content domains.
 * Each entry maps to a code path the pipeline branches on — see
 * tests/qa-fixtures/corpus/README for the full rationale.
 *
 * Items with `verified: true` were hand-picked from a YouTube ID search and
 * confirmed by the user 2026-05-31. Items with `verified: false` are slots
 * the user marked as "top up from <source>" — fill in the id before running.
 *
 * Per-program assemblages (CORPUS_PROGRAMS) group videos to stress a
 * specific code path through extractContentDigests → distributeClipsToLessons
 * → generateProgramDraft.
 */

export type DurationTier =
  | "lt-8min"      // <8 min — gemini-video-analyzer.ts prompt: exactly 1 topic
  | "5-8min"       // 5–8 min — straddles MIN_DURATION_FOR_SPLIT_SECONDS = 300s
  | "8-20min"      // 8–20 min — gemini topic rule: 1–3 topics
  | "gt-20min";    // >20 min — gemini topic rule: 2–5 topics + virtual segmentation if >10min

export type ContentShape =
  | "single-topic-ramble"     // Stresses Jaccard merge (topicsAreDistinct < 0.3 → collapse)
  | "multi-topic-structured"  // Chaptered content — clip-distribution happy path
  | "tutorial-stepped"        // Movement / how-to with explicit steps — MVP fitness lane
  | "movement-only"           // Low speech / transcript-poor — title-only fallback risk
  | "multi-speaker"           // 2+ speakers — people-detection stress
  | "single-host-talk"        // 1 host, structured argument (TED-style)
  | "explainer-essay";        // Narrated visual essay (Kurzgesagt-style)

export type CorpusVideo = {
  id: string;                 // YouTube video ID (11 chars); "" for unfilled top-up slots
  title: string;              // Display label only; Gemini fetches its own title
  tier: DurationTier;
  shapes: ContentShape[];
  source: string;             // Channel / origin
  verified: boolean;          // true = user-confirmed ID; false = top-up slot
  notes?: string;
};

export type CorpusProgram = {
  name: string;
  /** Learner-facing program title — what a real creator would name this program. */
  title: string;
  /** Internal description / curator notes — NOT shown to learners. */
  description: string;
  videoIds: string[];
  lessonCount: number;
  targetTransformation?: string;
  vibePrompt?: string;
  // Documented for the reviewer — which code path this assemblage stresses
  stresses: string;
};

export const CORPUS_VIDEOS: CorpusVideo[] = [
  // ── Tier 1: <8 min — exactly 1 topic ──────────────────────────────────────
  { id: "Tn6-PIqc4UM", title: "React in 100 Seconds", tier: "lt-8min", shapes: ["multi-topic-structured"], source: "Fireship", verified: true },
  { id: "zQnBQ4tB3ZA", title: "TypeScript in 100 Seconds", tier: "lt-8min", shapes: ["multi-topic-structured"], source: "Fireship", verified: true },
  { id: "DHjqpvDnNGE", title: "JavaScript in 100 Seconds", tier: "lt-8min", shapes: ["multi-topic-structured"], source: "Fireship", verified: true },
  { id: "lHhRhPV--G0", title: "Flutter in 100 Seconds", tier: "lt-8min", shapes: ["multi-topic-structured"], source: "Fireship", verified: true },
  { id: "VhJFyyukAzA", title: "Gordon Ramsay's Scrambled Eggs", tier: "lt-8min", shapes: ["tutorial-stepped"], source: "GMA", verified: true },
  { id: "x7X9w_GIm1s", title: "Python in 100 Seconds", tier: "lt-8min", shapes: ["multi-topic-structured"], source: "Fireship", verified: true },

  // ── Tier 2: 5–8 min — straddles MIN_DURATION_FOR_SPLIT_SECONDS = 300s ─────
  { id: "B7SWW_hBYcg", title: "'bad guy' beginner dance tutorial", tier: "5-8min", shapes: ["tutorial-stepped"], source: "dance channel", verified: true, notes: "User flagged: verify carefully on ingest" },
  { id: "KRVhtMxQWRs", title: "Animation basics: The art of timing and spacing", tier: "5-8min", shapes: ["explainer-essay", "tutorial-stepped"], source: "TED-Ed", verified: true, notes: "Duration unverified; TED-Ed lessons typically 4–7min — re-tier if outside band" },
  { id: "aISXCw0Pi94", title: "How Every Child Can Thrive by Five — Molly Wright (TED)", tier: "5-8min", shapes: ["single-host-talk"], source: "TED", verified: true, notes: "Duration unverified; main-stage TED, likely 7–9min — re-tier if outside band" },
  { id: "FfJ5XG5i2aw", title: "Introducing TED-Ed: Lessons Worth Sharing", tier: "5-8min", shapes: ["explainer-essay"], source: "TED-Ed", verified: true, notes: "Duration unverified — re-tier if outside band" },

  // ── Tier 3: 8–20 min — 1–3 topics ─────────────────────────────────────────
  { id: "LqQvDvQ-LK8", title: "NikkieTutorials — Power of Makeup", tier: "8-20min", shapes: ["tutorial-stepped"], source: "NikkieTutorials", verified: true },
  { id: "haD0CgfgBh8", title: "Bad Romance dance tutorial", tier: "8-20min", shapes: ["tutorial-stepped"], source: "dance channel", verified: true },
  { id: "hvWHBy1gDCE", title: "Greedy dance tutorial", tier: "8-20min", shapes: ["tutorial-stepped"], source: "dance channel", verified: true },
  { id: "PvkiibZkwzU", title: "Squabble Up dance tutorial", tier: "8-20min", shapes: ["tutorial-stepped"], source: "dance channel", verified: true },
  { id: "yJCc-JQnPr4", title: "Hustle dance tutorial", tier: "8-20min", shapes: ["tutorial-stepped"], source: "dance channel", verified: true },
  { id: "FfWtIaDtfYk", title: "Let's Travel to The Most Extreme Place in The Universe", tier: "8-20min", shapes: ["explainer-essay"], source: "Kurzgesagt", verified: true, notes: "Kurzgesagt typical length 9–12min" },
  { id: "XKSjCOKDtpk", title: "The Tiny Donut That Proved We Still Don't Understand Magnetism", tier: "8-20min", shapes: ["explainer-essay"], source: "Veritasium", verified: true, notes: "Veritasium 2026 release; typical length 10–20min" },
  { id: "qzR62JJCMBQ", title: "All it takes is 10 mindful minutes — Andy Puddicombe (TED)", tier: "8-20min", shapes: ["single-host-talk"], source: "TED", verified: true, notes: "Main-stage TED, ~10min" },
  { id: "GXy__kBVq1M", title: "The Happiness Advantage — Shawn Achor (TEDxBloomington)", tier: "8-20min", shapes: ["single-host-talk"], source: "TEDx", verified: true, notes: "TEDx, typically 12–18min" },
  { id: "gYeHV_nA36c", title: "The Simple Secret of Being Happier — Tia Graham (TEDxManitouSprings)", tier: "8-20min", shapes: ["single-host-talk"], source: "TEDx", verified: true },

  // ── Tier 4: >20 min — 2–5 topics, +virtual segmentation if >10min ─────────
  // Plus the two slots absorbed from the dropped long-form tier (option B).
  { id: "ZiQh8jA5tVM", title: "Yoga With Adriene — Healthy Body Yoga", tier: "gt-20min", shapes: ["tutorial-stepped"], source: "Yoga With Adriene", verified: true },
  { id: "AF9d2Icl4fA", title: "Yoga With Adriene — Yoga Stretch", tier: "gt-20min", shapes: ["tutorial-stepped"], source: "Yoga With Adriene", verified: true },
  { id: "P8uHMMmWMHQ", title: "Yoga With Adriene — Yoga Joy", tier: "gt-20min", shapes: ["tutorial-stepped"], source: "Yoga With Adriene", verified: true },
  { id: "iG9CE55wbtY", title: "Ken Robinson — Schools Kill Creativity (TED)", tier: "gt-20min", shapes: ["single-topic-ramble", "single-host-talk"], source: "TED", verified: true, notes: "Single continuous argument — Jaccard merge stress" },
  { id: "VLk0E9eGXDM", title: "Bad Romance — full performance", tier: "gt-20min", shapes: ["movement-only"], source: "dance channel (full cut)", verified: true, notes: "User flagged: confirm ID on ingest; transcript-poor case" },
  { id: "IY6VHBq3_MU", title: "Greedy — full performance", tier: "gt-20min", shapes: ["movement-only"], source: "dance channel (full cut)", verified: true, notes: "User flagged: confirm ID on ingest; transcript-poor case" },
  { id: "q2G5ZX0JgvQ", title: "30-Minute Yoga With Adriene to Reduce Stress", tier: "gt-20min", shapes: ["tutorial-stepped"], source: "Yoga With Adriene", verified: true, notes: "Explicit 30min in title" },
  { id: "GLy2rYHwUqY", title: "Total Body Yoga — Deep Stretch (45min)", tier: "gt-20min", shapes: ["tutorial-stepped"], source: "Yoga With Adriene", verified: true, notes: "Title-stated 45min" },
  { id: "hECYru0kEh4", title: "Highlights: Lex Fridman Interview with Sam Altman", tier: "gt-20min", shapes: ["multi-speaker"], source: "Lex Fridman (highlights reel)", verified: true, notes: "Multi-speaker, highlights cut — duration likely 30–45min" },
  { id: "WEm3EUdicDg", title: "Python Tutorial in 30 Minutes (Crash Course)", tier: "gt-20min", shapes: ["multi-topic-structured"], source: "freeCodeCamp-style", verified: true, notes: "Explicit 30min in title — chaptered structured" },

  // ─── Tutorial corpus expansion 2026-05-31 ────────────────────────────────
  // 20 tutorial videos × 8 subject domains. Independent / smaller channels
  // to minimize recitation risk. Duration estimates from title heuristics;
  // actual durations populated by Gemini on first analyze pass.

  // Cooking tutorials (Joshua Weissman) ×3
  { id: "DGb5Vn0PkcQ", title: "Hand Ripped Noodles That Everyone Should Make", tier: "8-20min", shapes: ["tutorial-stepped"], source: "Joshua Weissman", verified: true, notes: "Step-by-step cooking technique" },
  { id: "FSFTqzmuzy8", title: "The Sauces Everyone Needs to Know", tier: "gt-20min", shapes: ["tutorial-stepped", "multi-topic-structured"], source: "Joshua Weissman", verified: true, notes: "Multi-recipe compilation — tests multi-topic detection" },
  { id: "P6W8kwmwcno", title: "Learn How To Cook in Under 25 Minutes", tier: "gt-20min", shapes: ["tutorial-stepped", "multi-topic-structured"], source: "Joshua Weissman", verified: true, notes: "Explicit 25-min duration" },

  // Strength fitness (Caroline Girvan) ×3 — MVP fitness lane representative
  { id: "SZaggsg2zUY", title: "20 Minute HARD Upper Body Workout with Dumbbells", tier: "gt-20min", shapes: ["tutorial-stepped"], source: "Caroline Girvan", verified: true, notes: "Explicit 20-min — MVP lane" },
  { id: "l9_SoClAO5g", title: "20 Minute Dumbbell Full Body Workout - No Repeat", tier: "gt-20min", shapes: ["tutorial-stepped"], source: "Caroline Girvan", verified: true, notes: "Explicit 20-min — no-repeat structure stresses topic detection" },
  { id: "y87vSUoIMGU", title: "UNWIND 20 Min Full Body Stretch Routine", tier: "gt-20min", shapes: ["tutorial-stepped"], source: "Caroline Girvan", verified: true, notes: "Stretch routine — different shape than strength workout" },

  // Guitar 101 (Marty Music) ×3 — short tutorial format
  { id: "hb9G4EqA-LI", title: "Beginner Acoustic Guitar Lesson 3 - The G Major Chord", tier: "5-8min", shapes: ["tutorial-stepped"], source: "Marty Music", verified: true, notes: "Short tutorial format" },
  { id: "l2Ioh1iw8DE", title: "Beginner Lesson 4 D Major Chord", tier: "5-8min", shapes: ["tutorial-stepped"], source: "Marty Music", verified: true },
  { id: "TRZilL-BDbI", title: "Beginner Guitar Lesson 6 C Major Chord", tier: "5-8min", shapes: ["tutorial-stepped"], source: "Marty Music", verified: true },

  // JavaScript essentials (Web Dev Simplified) ×3 — varied length within subject
  { id: "2onAblXCQ_g", title: "This Is The Easiest React Hook", tier: "5-8min", shapes: ["tutorial-stepped"], source: "Web Dev Simplified", verified: true, notes: "Short coding tutorial" },
  { id: "v2tJ3nzXh8I", title: "5 Must Know JavaScript Features That Almost Nobody Knows", tier: "8-20min", shapes: ["tutorial-stepped", "multi-topic-structured"], source: "Web Dev Simplified", verified: true },
  { id: "7L2RLBmEJmE", title: "How To Learn JavaScript In 2023 - From Zero To Mid-Level Developer", tier: "gt-20min", shapes: ["single-host-talk", "multi-topic-structured"], source: "Web Dev Simplified", verified: true, notes: "Roadmap-style — multi-topic structure" },

  // Photography essays (Sean Tucker) ×2 — concept + demo blend
  { id: "upxY8U1XPB0", title: "Photography Composition: Thinking Beyond the Rules", tier: "8-20min", shapes: ["single-host-talk", "explainer-essay"], source: "Sean Tucker", verified: true, notes: "Essay-style tutorial" },
  { id: "dciqnBvoABw", title: "The Real Secret to Clearer, Sharper Photographs", tier: "8-20min", shapes: ["single-host-talk", "explainer-essay"], source: "Sean Tucker", verified: true },

  // Drawing fundamentals (Proko) ×2
  { id: "r-JhCL3a1uA", title: "How to Draw Anything - Drawing Basics Course", tier: "gt-20min", shapes: ["tutorial-stepped"], source: "Proko", verified: true, notes: "Long-form drawing course" },
  { id: "rNiBjHymU0k", title: "Figure Drawing Fundamentals - Introduction", tier: "8-20min", shapes: ["tutorial-stepped"], source: "Proko", verified: true },

  // Woodworking (Steve Ramsey) ×2
  { id: "2f9aH9sqHAI", title: "10 Woodworking Tips and Techniques for Beginners", tier: "8-20min", shapes: ["tutorial-stepped", "multi-topic-structured"], source: "Steve Ramsey — Woodworking for Mere Mortals", verified: true, notes: "Numbered-tip structure stresses topic count" },
  { id: "p8_Bn4JicW8", title: "7 things I wish I knew when I started woodworking", tier: "8-20min", shapes: ["tutorial-stepped", "single-host-talk"], source: "Steve Ramsey — Woodworking for Mere Mortals", verified: true },

  // Spanish comprehensible input (Dreaming Spanish) ×2
  { id: "-GJ0vMzIM_k", title: "Introduction to Dreaming Spanish | Learn with Comprehensible Input", tier: "5-8min", shapes: ["single-host-talk", "explainer-essay"], source: "Dreaming Spanish", verified: true, notes: "Short intro video" },
  { id: "NyT5S_PQfpc", title: "LEARN SPANISH With This Comprehensible Input Story - Superbeginner Spanish", tier: "8-20min", shapes: ["tutorial-stepped"], source: "Dreaming Spanish", verified: true, notes: "Story-driven tutorial — language-learning shape" },

  // ─── Pressure-test expansion 2026-06-01 — 15 more tutorials × 5 programs ─
  // Targeting: different instrument tutorial (piano vs prior guitar), long
  // cooking process (bread/baking), conceptual non-stepwise (meditation),
  // creator-with-sponsors (gardening), conceptual-with-structure (finance).

  // Piano fundamentals (Pianote + variety) ×3
  { id: "EpM6CndtFPM", title: "Your First Piano Chords - Piano Lesson (Pianote)", tier: "8-20min", shapes: ["tutorial-stepped"], source: "Pianote", verified: true, notes: "Demonstration-heavy music tutorial" },
  { id: "tEtukfFv3Wk", title: "How To Play Piano (Your First Piano Lesson)", tier: "8-20min", shapes: ["tutorial-stepped"], source: "Pianote", verified: true },
  { id: "kjpbwL7lvxo", title: "A Beginner's Guide To Piano Chord Progressions (with Kaitlyn)", tier: "8-20min", shapes: ["tutorial-stepped"], source: "Pianote", verified: true },

  // Sourdough baking (King Arthur + variety) ×3
  { id: "9W0Rmfj5VzQ", title: "Rustic Sourdough bread (King Arthur Recipe) step by step", tier: "8-20min", shapes: ["tutorial-stepped"], source: "King Arthur Baking", verified: true, notes: "Long multi-step process" },
  { id: "BDf5mOfSkkw", title: "The Only Sourdough Recipe You'll Ever Need", tier: "gt-20min", shapes: ["tutorial-stepped", "multi-topic-structured"], source: "King Arthur Baking", verified: true },
  { id: "hB6b9jYPGjQ", title: "Easy No Knead Sourdough — King Arthur Flour Recipe", tier: "8-20min", shapes: ["tutorial-stepped"], source: "King Arthur Baking", verified: true },

  // Meditation / mindfulness ×3 — conceptual, non-stepwise content
  { id: "kwHuMRzMGXk", title: "Yoga for Beginners - 30 min Guided Meditation and Beginner Level Full Body Yoga", tier: "gt-20min", shapes: ["tutorial-stepped", "single-host-talk"], source: "yoga channel", verified: true, notes: "30-min mixed meditation+yoga — pressures source-genre rule" },
  { id: "k7gU-fLVILA", title: "Yoga Nidra (Guided Meditation)", tier: "gt-20min", shapes: ["single-host-talk"], source: "meditation channel", verified: true, notes: "Pure guided meditation — long-form conceptual content" },
  { id: "FcXEZF6y5WQ", title: "10 Minute Morning Yoga to FEEL INCREDIBLE!", tier: "5-8min", shapes: ["tutorial-stepped"], source: "Yoga With Bird", verified: true, notes: "Short morning routine — different shape than long meditation" },

  // Epic Gardening (vegetable garden basics) ×3
  { id: "X3SP1Fub3bw", title: "How to Start Your First Garden (COMPLETE GUIDE)", tier: "gt-20min", shapes: ["tutorial-stepped", "multi-topic-structured"], source: "Epic Gardening", verified: true, notes: "Comprehensive guide — likely has sponsor segments" },
  { id: "9R-utqpmwmE", title: "Planning a Vegetable Garden for Beginners: The 5 Golden Rules", tier: "8-20min", shapes: ["tutorial-stepped", "multi-topic-structured"], source: "Epic Gardening", verified: true, notes: "Numbered structure — should produce clear topic boundaries" },
  { id: "bcn8XgLs-H8", title: "Start Your 2025 Vegetable Garden: Plan It In 5 Easy Steps", tier: "8-20min", shapes: ["tutorial-stepped", "multi-topic-structured"], source: "Epic Gardening", verified: true },

  // The Plain Bagel (personal finance / investing) ×3
  { id: "I81xqr8HzBE", title: "The Fundamentals | Why is Investing Important?", tier: "5-8min", shapes: ["single-host-talk", "explainer-essay"], source: "The Plain Bagel", verified: true, notes: "Short concept video" },
  { id: "T1cqSZUviiQ", title: "Investing | 5 Steps for Getting Started", tier: "8-20min", shapes: ["tutorial-stepped", "multi-topic-structured"], source: "The Plain Bagel", verified: true, notes: "Numbered tutorial — clear step structure" },
  { id: "wFlBrYa4nrw", title: "Intro to Investing | Guest Lecture with Richard Coffin", tier: "gt-20min", shapes: ["single-host-talk"], source: "The Plain Bagel (guest lecture)", verified: true, notes: "Long lecture format — pressures conceptual-content path" },
];

export const CORPUS_PROGRAMS: CorpusProgram[] = [
  {
    name: "fireship-coding-shorts",
    title: "Coding Quickstart: A Whirlwind Tour of Modern Languages",
    description: "6 Fireship-style 100-second coding intros bundled as a coding fundamentals primer.",
    videoIds: ["Tn6-PIqc4UM", "zQnBQ4tB3ZA", "DHjqpvDnNGE", "lHhRhPV--G0", "VhJFyyukAzA", "x7X9w_GIm1s"],
    lessonCount: 3,
    targetTransformation: "Understand the language landscape in an afternoon",
    stresses: "<8min topic-count gate (must produce 1 topic per video). Tests no-split path in clip-distributor (durations below MIN_DURATION_FOR_SPLIT_SECONDS). Tests 1-clip-per-video lesson assignment.",
  },
  {
    name: "ted-talks-bundle",
    title: "Practical Psychology: Habits, Mindfulness, and Motivation",
    description: "Mix of TED main-stage and TED-Ed talks/lessons assembled as a happiness/learning series.",
    videoIds: ["aISXCw0Pi94", "qzR62JJCMBQ", "GXy__kBVq1M", "gYeHV_nA36c", "KRVhtMxQWRs"],
    lessonCount: 4,
    targetTransformation: "Find practical psychology to live better",
    stresses: "8–20min topic gate + single-host-talk shape. Mixed TED-Ed (5–7min explainer) and TED main-stage (10–18min) tests duration-tier transitions in the prompt. Mix of explainer-essay and single-host-talk shapes in one assemblage.",
  },
  {
    name: "explainer-essays",
    title: "Big-Picture Science: Visual Essays on the Cosmos and Matter",
    description: "Kurzgesagt + Veritasium narrated visual essays as an evening science survey.",
    videoIds: ["FfWtIaDtfYk", "XKSjCOKDtpk"],
    lessonCount: 3,
    targetTransformation: "Catch up on big-picture science",
    stresses: "Explainer-essay shape — narration-heavy with strong visual structure. Tests whether Gemini's topic boundaries align with the essay's rhetorical sections (not just spoken text).",
  },
  {
    name: "long-form-mixed",
    title: "Deep Dives: Long-Form Learning Across Tech, Movement, and Conversation",
    description: "Multi-speaker interview + chaptered tutorial + long-form yoga — mixed long-form shapes.",
    videoIds: ["hECYru0kEh4", "WEm3EUdicDg", "GLy2rYHwUqY", "q2G5ZX0JgvQ"],
    lessonCount: 6,
    targetTransformation: "Sample long-form learning across shapes",
    stresses: ">20min topic gate + >10min virtual-segmentation path on four distinct shapes (multi-speaker, chaptered structured, tutorial). People-detection stress from the multi-speaker pick.",
  },
  {
    name: "dance-tutorial-bundle",
    title: "Learn 5 Choreographed Routines, One Step at a Time",
    description: "5 dance tutorial videos as a step-by-step choreography series.",
    videoIds: ["B7SWW_hBYcg", "LqQvDvQ-LK8", "haD0CgfgBh8", "hvWHBy1gDCE", "PvkiibZkwzU"],
    lessonCount: 5,
    targetTransformation: "Learn 5 routines step by step",
    stresses: "8-20min topic gate (1-3 topics). Tutorial shape — stresses whether clip distribution preserves step ordering across videos. Includes mixed beauty (Nikkie) to test cross-domain LLM titling.",
  },
  {
    name: "yoga-long-form",
    title: "A Steady Home Yoga Practice with Adriene",
    description: "3 long Yoga With Adriene practices as a multi-week home practice.",
    videoIds: ["ZiQh8jA5tVM", "AF9d2Icl4fA", "P8uHMMmWMHQ"],
    lessonCount: 6,
    targetTransformation: "Build a steady home yoga practice",
    stresses: ">20min topic gate (2-5 topics) and the >10min virtual-segmentation path. Movement-heavy tutorial shape — common MVP-lane content.",
  },
  {
    name: "single-topic-ramble",
    title: "Creativity and Movement: One Idea at a Time",
    description: "Ken Robinson TED + Hustle tutorial — diverse single-topic videos to test Jaccard merge.",
    videoIds: ["iG9CE55wbtY", "yJCc-JQnPr4"],
    lessonCount: 3,
    targetTransformation: "Explore creativity and movement",
    stresses: "Single-topic ramble shape — does Gemini wrongly split one continuous argument into multiple topics? Tests Jaccard distinctness threshold (>0.3 collapses topics).",
  },
  {
    name: "movement-only-corpus",
    title: "Study a Routine: Watching Choreography Closely",
    description: "Full dance performances — transcript-poor / low-speech content.",
    videoIds: ["VLk0E9eGXDM", "IY6VHBq3_MU"],
    lessonCount: 2,
    targetTransformation: "Study choreography",
    stresses: "Movement-only shape (low speech). Tests transcript-poor fallback path in extractContentDigests and curriculum-gen's behavior without rich transcripts.",
  },
  {
    name: "cooking-isolated",
    title: "The Perfect Scrambled Eggs, Gordon Ramsay's Way",
    description: "Single-domain cooking program — isolates the cooking-content code path from coding shorts.",
    videoIds: ["VhJFyyukAzA"],
    lessonCount: 1,
    targetTransformation: "Cook perfect scrambled eggs",
    stresses: "Single-video <8min program — isolates cooking domain so any title/sequencing oddity is unambiguously attributable to cooking content (not bundled-in coding shorts). Stresses lessonCount=1 edge case.",
  },
  {
    name: "beauty-isolated",
    title: "Behind the Brand: NikkieTutorials and the Power of Makeup",
    description: "Single-domain beauty program — isolates the makeup/beauty path from dance tutorials.",
    videoIds: ["LqQvDvQ-LK8"],
    lessonCount: 2,
    targetTransformation: "Master your makeup routine",
    stresses: "Single-video 8-20min program — isolates beauty domain so any title/sequencing oddity is unambiguously attributable to beauty content (not bundled-in dance tutorials). Tests whether NikkieTutorials' YouTube-chaptered structure surfaces as multi-topic segmentation.",
  },

  // ─── Tutorial expansion 2026-05-31 — 8 new programs ──────────────────────
  {
    name: "joshua-cooking-fundamentals",
    title: "Cooking Fundamentals: Pasta, Sauces, and 25-Minute Meals",
    description: "3 Joshua Weissman tutorials covering core technique-driven cooking skills.",
    videoIds: ["DGb5Vn0PkcQ", "FSFTqzmuzy8", "P6W8kwmwcno"],
    lessonCount: 4,
    targetTransformation: "Cook confidently from scratch using core technique",
    stresses: "Tutorial-stepped shape across short-to-long cooking content. Tests whether multi-recipe/multi-topic structure (Sauces Guide, Cook in 25 Min) produces clean topic boundaries vs the simpler single-technique video (Hand Ripped Noodles).",
  },
  {
    name: "caroline-girvan-strength",
    title: "Strength Training Foundations: A Week of 20-Minute Sessions",
    description: "3 Caroline Girvan 20-min dumbbell workouts assembled as a week-long strength program.",
    videoIds: ["SZaggsg2zUY", "l9_SoClAO5g", "y87vSUoIMGU"],
    lessonCount: 3,
    targetTransformation: "Build a sustainable home strength routine",
    stresses: "MVP fitness-lane representative — all 20-min movement tutorials with explicit set/exercise structure. Tests how the brain handles exercise-by-exercise topic detection (the prompt should produce a topic per exercise block, not a single ramble).",
  },
  {
    name: "guitar-101-marty",
    title: "Guitar 101: Your First Three Chords",
    description: "3 Marty Music beginner lessons (G, D, C major chord) as a foundational guitar program.",
    videoIds: ["hb9G4EqA-LI", "l2Ioh1iw8DE", "TRZilL-BDbI"],
    lessonCount: 3,
    targetTransformation: "Play your first chord progression in a week",
    stresses: "Short-tutorial shape (<8min each). Tests the <8min topic-count gate (each lesson should produce exactly 1 topic — chord introduction + demonstration is one topic, not two). Cross-video lesson sequencing — does the LLM keep G/D/C in pedagogical order?",
  },
  {
    name: "javascript-essentials",
    title: "JavaScript Essentials: From React Hooks to Career Roadmap",
    description: "3 Web Dev Simplified tutorials — short hook lesson, medium feature roundup, long roadmap.",
    videoIds: ["2onAblXCQ_g", "v2tJ3nzXh8I", "7L2RLBmEJmE"],
    lessonCount: 5,
    targetTransformation: "Level up your JavaScript fluency",
    stresses: "Cross-duration coverage within a single subject — short (~5-10min) + medium (8-20min) + long (>20min). Tests how the brain weights different content lengths in the same program. The Roadmap video (multi-section list format) should produce many distinct topics; the React Hook video should produce one.",
  },
  {
    name: "sean-tucker-photography",
    title: "The Why of Photography: Composition and Clarity",
    description: "2 Sean Tucker essay-style tutorials on composition and sharper photographs.",
    videoIds: ["upxY8U1XPB0", "dciqnBvoABw"],
    lessonCount: 3,
    targetTransformation: "Take photographs with intentional composition",
    stresses: "Essay/single-host-talk shape — narration-heavy, concept-driven (not stepwise). Tests whether the brain produces a coherent curriculum from conceptual content (vs the easier case of step-by-step instructions).",
  },
  {
    name: "proko-drawing-basics",
    title: "Drawing Basics: From Anything to Figure Fundamentals",
    description: "Proko's Drawing Basics Course + Figure Drawing Fundamentals intro.",
    videoIds: ["r-JhCL3a1uA", "rNiBjHymU0k"],
    lessonCount: 4,
    targetTransformation: "Build a daily drawing practice",
    stresses: "Long-form tutorial (Drawing Anything course) + medium intro (Figure Drawing). Tests >20min virtual-segmentation path AND cross-video lesson boundary placement. The course video should produce many topics; the intro video, fewer.",
  },
  {
    name: "steve-ramsey-woodworking",
    title: "Mere-Mortal Woodworking: Tips, Mistakes, and First Steps",
    description: "2 Steve Ramsey beginner-focused woodworking lists.",
    videoIds: ["2f9aH9sqHAI", "p8_Bn4JicW8"],
    lessonCount: 3,
    targetTransformation: "Set up a budget home woodworking shop",
    stresses: "Numbered-list tutorial structure (\"10 Tips\", \"7 things\"). Tests whether the brain respects the explicit enumeration in the source (each numbered tip = a topic boundary) rather than collapsing them into a single ramble.",
  },
  {
    name: "dreaming-spanish-intro",
    title: "Start Learning Spanish: Comprehensible Input Foundations",
    description: "2 Dreaming Spanish tutorials — intro to the method + a beginner story.",
    videoIds: ["-GJ0vMzIM_k", "NyT5S_PQfpc"],
    lessonCount: 2,
    targetTransformation: "Build a daily Spanish input habit",
    stresses: "Language-learning shape — mixes concept explanation (intro video) with practice content (story video). Tests how the brain handles two structurally different videos in one program.",
  },

  // ─── Pressure-test 2026-06-01 — 5 new programs designed to exercise fixes ─

  {
    name: "piano-fundamentals",
    title: "Piano Fundamentals: From First Chords to Your First Song",
    description: "3 Pianote beginner lessons covering chord shapes, basic playing, and progressions.",
    videoIds: ["EpM6CndtFPM", "tEtukfFv3Wk", "kjpbwL7lvxo"],
    lessonCount: 4,
    targetTransformation: "Play your first chord progression on piano this week",
    stresses: "Music tutorial w/ different instrument from guitar — demonstration-heavy with two-handed coordination explanation. Tests whether brain handles instrument-tutorial shape consistently across instruments.",
  },
  // sourdough-baking program DROPPED for this run — only 1 of 3 videos survived analysis
  // (King Arthur Rustic = RECITATION, "Only Recipe" pick was a 15-second Shorts trailer).
  // Re-add when better video IDs are sourced.
  {
    name: "meditation-basics",
    title: "Meditation Basics: Start a Daily Mindfulness Practice",
    description: "2 guided meditation / mindful yoga videos — short morning routine + longer guided session.",
    videoIds: ["FcXEZF6y5WQ", "kwHuMRzMGXk"],
    lessonCount: 3,
    targetTransformation: "Build a 10-minute daily meditation habit",
    stresses: "Conceptual / non-stepwise content — guided meditation has different shape than tutorial demonstration. Pressures source-genre-honor rule. Mixes short (10min) with long (30min) which exercises duration-tier handling.",
  },
  {
    name: "epic-gardening-vegetables",
    title: "Start Your First Vegetable Garden",
    description: "3 Epic Gardening tutorials covering planning and starting a beginner vegetable garden.",
    videoIds: ["X3SP1Fub3bw", "9R-utqpmwmE", "bcn8XgLs-H8"],
    lessonCount: 4,
    targetTransformation: "Plan and plant your first vegetable garden",
    stresses: "Outdoor/seasonal content with creator-style sponsor segments — pressures promo topic filter. Numbered tutorials ('5 Golden Rules', '5 Easy Steps') should produce clear topic boundaries — tests numbered-list shape consistency.",
  },
  {
    name: "plain-bagel-investing",
    title: "Investing Fundamentals: From Why to How",
    description: "3 Plain Bagel videos taking a learner from investing concept to first steps to deeper understanding.",
    videoIds: ["I81xqr8HzBE", "T1cqSZUviiQ", "wFlBrYa4nrw"],
    lessonCount: 5,
    targetTransformation: "Make informed first investment decisions",
    stresses: "Conceptual content with explicit structure — pressures title-clip alignment rule (the joshua-cooking failure mode). lessonCount(5) > videoCount(3) which exercises split-to-fill — the javascript-essentials regression scenario. This program is the explicit retest of the two known edge cases.",
  },
];
