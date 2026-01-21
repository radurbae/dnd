import { generateText } from "ai";
import type { LanguageModelV1 } from "ai";
import { openai } from "@ai-sdk/openai";

type DetailPayload = {
  backstory: string;
  skills: string[];
  equipment: Array<{ name: string; type: string; quantity: number }>;
};

function normalizePayload(input: DetailPayload): DetailPayload {
  return {
    backstory: String(input.backstory ?? "").trim(),
    skills: Array.isArray(input.skills)
      ? input.skills.map((skill) => String(skill).trim()).filter(Boolean)
      : [],
    equipment: Array.isArray(input.equipment)
      ? input.equipment
          .map((item) => ({
            name: String(item?.name ?? "").trim(),
            type: String(item?.type ?? "").trim(),
            quantity: Math.max(1, Math.floor(Number(item?.quantity ?? 1)))
          }))
          .filter((item) => item.name)
      : []
  };
}

export async function POST(request: Request) {
  const { className, race } = (await request.json()) as {
    className?: string;
    race?: string;
  };

  if (!className || !race) {
    return new Response("Missing class or race", { status: 400 });
  }

  const system =
    "Return ONLY valid JSON that matches this schema: " +
    '{"backstory":"string","skills":["string","string"],"equipment":[{"name":"string","type":"string","quantity":number},{"name":"string","type":"string","quantity":number},{"name":"string","type":"string","quantity":number}]}. ' +
    "Backstory must be exactly 2 sentences. Skills must be 2 items. Equipment must be 3 items and include one flavor item that is not a weapon.";

  const { text } = await generateText({
    model: openai("gpt-4o-mini") as unknown as LanguageModelV1,
    system,
    prompt: `Class: ${className}. Race: ${race}.`
  });

  try {
    const parsed = JSON.parse(text) as DetailPayload;
    const normalized = normalizePayload(parsed);
    return Response.json(normalized);
  } catch {
    return new Response("Failed to parse details JSON", { status: 500 });
  }
}
