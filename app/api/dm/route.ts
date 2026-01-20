import { streamText } from "ai";
import type { LanguageModelV1 } from "ai";
import { openai } from "@ai-sdk/openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { summarizeRoom } from "../../lib/summarize";

function buildDungeonMasterPrompt(partySummary: string, campaignSummary: string) {
  return (
    "You are the Dungeon Master for a Dungeons & Dragons session. " +
    "Focus on narrative rule of cool over strict mathematics. " +
    "Use this Lightweight Logic: The Core Loop: When a player attempts an action, ask for a relevant Skill Check (d20). " +
    "Simple DCs: Judge difficulty on a simple scale: Easy (DC 10), Medium (DC 15), Hard (DC 20), Impossible (DC 25). " +
    "Narrative Combat: Do not track exact enemy HP numbers internally. Instead, track 'Hits'. " +
    "A goblin dies in 1-2 solid hits; a boss takes 5-8. Describe damage viscerally rather than mathematically. " +
    "Player Agency: Always let the dice decide the outcome. If they roll a Nat 20, make it epic. " +
    "If they roll a Nat 1, make it a funny or dramatic failure. " +
    "Respond in vivid, concise narration, describing the scene or asking for a roll. " +
    "Keep responses under 120 words and end with a prompt or decision point. " +
    `Party roster: ${partySummary}. ` +
    `Campaign summary so far: ${campaignSummary}.`
  );
}

function getConvexUrl() {
  return (
    process.env.CONVEX_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    ""
  );
}

export async function POST(request: Request) {
  const { roomCode, playerName } = (await request.json()) as {
    roomCode?: string;
    playerName?: string;
  };

  if (!roomCode || !playerName) {
    return new Response("Missing roomCode or playerName", { status: 400 });
  }

  if (!getConvexUrl()) {
    return new Response("Missing CONVEX_URL", { status: 500 });
  }

  const convex = new ConvexHttpClient(getConvexUrl());
  const [history, party, room] = await Promise.all([
    convex.query(api.messages.listRecent, { roomCode }),
    convex.query(api.players.listByRoomPublic, { roomCode }),
    convex.query(api.rooms.getByCode, { roomCode })
  ]);

  const messages = history.map((message) => {
    const role = message.playerName === "Dungeon Master" ? "assistant" : "user";
    const prefix =
      message.kind === "system" ? "System Event" : message.playerName;
    const content = `${prefix}: ${message.body}`;
    return { role, content } as const;
  });

  const partySummary = party.length
    ? party
        .map(
          (member) =>
            `${member.playerName} the ${member.className} (HP ${member.hp}, inventory: ${member.inventory || "empty"})`
        )
        .join("; ")
    : "No character sheets yet";

  const campaignSummary =
    room?.summary?.trim() || "No campaign summary yet";

  const result = await streamText({
    model: openai("gpt-4o-mini") as unknown as LanguageModelV1,
    system: buildDungeonMasterPrompt(partySummary, campaignSummary),
    messages
  });

  void result.text.then(async (text) => {
    if (!text.trim()) {
      return;
    }

    const sendResult = await convex.mutation(api.messages.send, {
      roomCode,
      playerName: "Dungeon Master",
      body: text
    });

    if (sendResult?.needsSummary) {
      await summarizeRoom(convex, roomCode);
    }
  });

  return result.toTextStreamResponse();
}
