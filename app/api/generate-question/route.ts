import { createId } from "@/lib/engine";
import { QUESTION_TYPES_BY_SECTION } from "@/lib/question-bank";
import type { Difficulty, Question, QuestionType, SectionId } from "@/lib/types";

type StudioRequest = {
  section?: SectionId;
  type?: QuestionType;
  topic?: string;
  difficulty?: Difficulty;
};

type ResponsesPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const validSections: SectionId[] = ["quant", "verbal", "data"];

function extractOutputText(payload: ResponsesPayload) {
  if (payload.output_text) {
    return payload.output_text;
  }

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function toDifficulty(value: unknown): Difficulty {
  const number = Math.round(Number(value));
  return Math.min(Math.max(number || 3, 1), 5) as Difficulty;
}

function validateRequest(body: StudioRequest) {
  const section = validSections.includes(body.section as SectionId) ? (body.section as SectionId) : "quant";
  const type = QUESTION_TYPES_BY_SECTION[section].includes(body.type as QuestionType)
    ? (body.type as QuestionType)
    : QUESTION_TYPES_BY_SECTION[section][0];

  return {
    section,
    type,
    topic: String(body.topic || "GMAT foundations").slice(0, 80),
    difficulty: toDifficulty(body.difficulty),
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-5.5";

  if (!apiKey) {
    return Response.json(
      {
        error:
          "OPENAI_API_KEY is not configured. Add it to your local .env to enable Question Studio generation.",
      },
      { status: 503 },
    );
  }

  const settings = validateRequest((await request.json()) as StudioRequest);

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["prompt", "choices", "correctChoice", "explanation", "tags", "estimatedTimeSeconds"],
    properties: {
      prompt: {
        type: "string",
        minLength: 40,
        maxLength: 1200,
      },
      choices: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: { type: "string", minLength: 1, maxLength: 180 },
      },
      correctChoice: {
        type: "integer",
        minimum: 0,
        maximum: 4,
      },
      explanation: {
        type: "string",
        minLength: 40,
        maxLength: 1200,
      },
      tags: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: { type: "string", minLength: 1, maxLength: 40 },
      },
      estimatedTimeSeconds: {
        type: "integer",
        minimum: 60,
        maximum: 240,
      },
    },
  };

  const prompt = [
    "Create one original GMAT-style practice question.",
    "Do not quote, paraphrase, or imitate any official GMAT/GMAC question.",
    `Section: ${settings.section}.`,
    `Question type: ${settings.type}.`,
    `Topic: ${settings.topic}.`,
    `Difficulty from 1 to 5: ${settings.difficulty}.`,
    "Use five answer choices and exactly one correct answer.",
    "For Data Insights, include any table or multi-source information directly in the prompt text.",
    "Keep wording concise, test-like, and unbranded.",
  ].join("\n");

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "gmat_practice_question",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text();
    return Response.json(
      { error: `OpenAI request failed: ${errorText.slice(0, 240)}` },
      { status: 502 },
    );
  }

  const payload = (await openaiResponse.json()) as ResponsesPayload;
  const text = extractOutputText(payload);

  try {
    const parsed = JSON.parse(text) as Pick<
      Question,
      "prompt" | "choices" | "correctChoice" | "explanation" | "tags" | "estimatedTimeSeconds"
    >;

    const question: Question = {
      id: createId("ai"),
      section: settings.section,
      type: settings.type,
      topic: settings.topic,
      difficulty: settings.difficulty,
      prompt: parsed.prompt,
      choices: parsed.choices,
      correctChoice: Math.min(Math.max(Number(parsed.correctChoice), 0), 4),
      explanation: parsed.explanation,
      tags: parsed.tags,
      estimatedTimeSeconds: parsed.estimatedTimeSeconds,
      source: "ai",
    };

    return Response.json({ question });
  } catch {
    return Response.json(
      { error: "OpenAI returned an invalid structured question draft." },
      { status: 502 },
    );
  }
}
