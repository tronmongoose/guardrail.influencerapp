import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

type EnhanceType =
  | "outcome"
  | "description"
  | "transformation"
  | "target_audience"
  | "session_summary"
  | "action_instructions"
  | "reflection_prompt"
  | "key_takeaway";

function sanitizeInput(text: string): string {
  // Truncate to reasonable length and strip control characters
  return text.slice(0, 2000).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function buildPrompt(type: EnhanceType, input: string, context?: string): string {
  const sanitizedInput = sanitizeInput(input);
  const sanitizedContext = context ? sanitizeInput(context) : undefined;
  const contextBlock = sanitizedContext
    ? `\nProgram context: ${sanitizedContext}\n`
    : "";

  const prompts: Record<EnhanceType, string> = {
    outcome: `You are a marketing expert helping course creators write compelling outcome statements.
${contextBlock}
Take the user's rough outcome statement and transform it into a specific, measurable, and compelling version.

Guidelines:
- Keep it to 1-2 sentences max
- Make it specific and measurable (e.g., "10lbs of muscle" not "get fit")
- Use active, transformation-focused language
- Focus on the end result, not the process

Input: "${sanitizedInput}"

Respond with ONLY the improved outcome statement, no quotes or explanation.`,

    description: `You are a copywriting expert helping course creators write engaging program descriptions.
${contextBlock}
Take the user's rough description and transform it into compelling sales copy.

Guidelines:
- Keep it to 2-3 sentences max
- Lead with the transformation or benefit
- Be specific about what learners will achieve
- Create urgency or emotional connection

Input: "${sanitizedInput}"

Respond with ONLY the improved description, no quotes or explanation.`,

    transformation: `You are a conversion copywriter specializing in creator programs. This text is the hero headline on a creator's public sales page — the first thing a potential buyer reads.

Write a short, punchy, emotionally resonant transformation statement. Think tagline energy: bold, specific, makes someone feel "that's exactly what I want."
${contextBlock}
Guidelines:
- 10 words or fewer — shorter is better
- Lead with the result the learner walks away with, not the process
- Use vivid, concrete language (avoid generic words like "improve", "better", "transform")
- No hype words like "amazing", "incredible", "life-changing"
- No punctuation at the end unless it's a strong exclamation
- Do NOT use "from X to Y" format — just state the destination powerfully

Examples of the right tone:
- "Run your first 5K — pain-free and confident"
- "Build real strength without stepping in a gym"
- "Finally meditate daily without forcing it"

Input: "${sanitizedInput}"

Respond with ONLY the improved tagline, no quotes or explanation.`,

    target_audience: `You are a curriculum design expert helping course creators define their target learner.
${contextBlock}
Take the user's rough audience description and make it clear and specific.

Guidelines:
- Write a concise 1-2 sentence group profile (no fictional names or persona stories)
- Include who they are, their skill level, and what they want to achieve
- Identify the core pain point or aspiration
- Use a group description, not a fictional individual (e.g., "intermediate runners who want to..." not "Meet Sarah, a 32-year-old...")

Input: "${sanitizedInput}"

Respond with ONLY the improved audience description, no quotes or explanation.`,

    session_summary: `You are a curriculum designer helping course creators write clear session descriptions.
${contextBlock}
Take the user's rough session description and make it compelling and clear.

Guidelines:
- Start with what the learner will accomplish
- Be specific about skills or knowledge gained
- Keep it to 2-3 sentences
- Use active, engaging language

Input: "${sanitizedInput}"

Respond with ONLY the improved session description, no quotes or explanation.`,

    action_instructions: `You are a curriculum designer helping course creators write clear action instructions.
${contextBlock}
Take the user's rough instructions and make them actionable and easy to follow.

Guidelines:
- Be specific about what the learner should do
- Break complex tasks into clear steps if needed
- Use direct, encouraging language
- Keep it concise but complete

Input: "${sanitizedInput}"

Respond with ONLY the improved instructions, no quotes or explanation.`,

    reflection_prompt: `You are a learning designer helping course creators write thought-provoking reflection prompts.
${contextBlock}
Take the user's rough reflection prompt and make it more insightful and thought-provoking.

Guidelines:
- Ask one clear question that promotes deep thinking
- Connect to personal experience or application
- Avoid yes/no questions — encourage narrative responses
- Keep it to 1-2 sentences

Input: "${sanitizedInput}"

Respond with ONLY the improved reflection prompt, no quotes or explanation.`,

    key_takeaway: `You are a curriculum designer helping course creators write concise key takeaways.
${contextBlock}
Take the user's rough takeaway and make it punchy and memorable.

Guidelines:
- One clear, actionable point
- Start with a verb or key concept
- Keep under 100 characters if possible
- Make it something a learner would remember

Input: "${sanitizedInput}"

Respond with ONLY the improved takeaway, no quotes or explanation.`,
  };

  return prompts[type];
}

export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { text, type = "outcome", context } = body as {
      text: string;
      type?: EnhanceType;
      context?: string;
    };

    if (!text || text.trim().length < 5) {
      return NextResponse.json(
        { error: "Please provide at least 5 characters to enhance" },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(type, text.trim(), context);
    if (!prompt) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Try Anthropic first, then OpenAI
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    let enhanced: string;

    if (anthropicKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        throw new Error(`Anthropic API error: ${res.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      enhanced = data?.content?.[0]?.text?.trim();
      if (!enhanced) throw new Error("Unexpected Anthropic response format");
    } else if (openaiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 256,
        }),
      });

      if (!res.ok) {
        throw new Error(`OpenAI API error: ${res.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      enhanced = data?.choices?.[0]?.message?.content?.trim();
      if (!enhanced) throw new Error("Unexpected OpenAI response format");
    } else {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }

    logger.info({
      operation: "ai.enhance",
      userId: user.id,
      type,
      inputLength: text.length,
      outputLength: enhanced.length,
    });

    return NextResponse.json({ enhanced });
  } catch (error) {
    logger.error({ operation: "ai.enhance_failed" }, error);
    return NextResponse.json(
      { error: "Failed to enhance text" },
      { status: 500 }
    );
  }
}
