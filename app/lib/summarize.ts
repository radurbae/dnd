import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

export async function summarizeRoom(
  convex: ConvexHttpClient,
  roomCode: string
) {
  const room = await convex.query(api.rooms.getByCode, { roomCode });
  if (!room) {
    return null;
  }

  if (room.messageCount < 20 || room.messageCount <= room.summaryCount) {
    return null;
  }

  const history = await convex.query(api.messages.listRecentLimit, {
    roomCode,
    limit: 20
  });

  const summaryPrompt =
    "You are a D&D campaign chronicler. Summarize the plot so far in 3-5 sentences. " +
    "Keep key NPCs, locations, and quests. End with the current cliffhanger or goal.";

  const historyText = history
    .map((message) => {
      const prefix = message.kind === "system" ? "System Event" : message.playerName;
      return `${prefix}: ${message.body}`;
    })
    .join("\n");

  const summaryResult = await generateText({
    model: openai("gpt-4o-mini"),
    system: summaryPrompt,
    prompt:
      `Previous summary: ${room.summary || "None"}\n` +
      `Recent log:\n${historyText}`
  });

  const summaryText = summaryResult.text?.trim();
  if (!summaryText) {
    return null;
  }

  await convex.mutation(api.rooms.updateSummary, {
    roomCode,
    summary: summaryText,
    summaryCount: room.messageCount
  });

  return summaryText;
}
