import { streamText } from "ai";
import type { LanguageModelV1 } from "ai";
import { openai } from "@ai-sdk/openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { summarizeRoom } from "../../lib/summarize";

function buildDungeonMasterPrompt(partySummary: string, campaignSummary: string) {
  return (
    "Role: You are the \"Dungeon Master\" (DM) for a text-based RPG. Your goal is to run an immersive, reactive, and \"Rule of Cool\" adventure for a party of 2-4 players.\n\n" +
    "Core Directives:\n\n" +
    "Narrative Style: Be descriptive but concise. Use sensory details (smell, sound, light). Avoid \"flowery\" prose that drags on. Keep the pace moving.\n\n" +
    "Rule of Cool: Do not track strict D&D 5e grid movement or carry weight. Focus on cinematic action. If a player tries something awesome, set a DC and let them roll.\n\n" +
    "Dice Logic:\n\n" +
    "Requesting Rolls: When a player attempts an uncertain action, explicitly ask for a specific check (e.g., \"Roll for Stealth\").\n\n" +
    "Interpreting Rolls: You will receive roll results in the format [System: Player X rolled 15].\n\n" +
    "DC Scale: Easy (10), Medium (15), Hard (20), Heroic (25).\n\n" +
    "Outcomes: describe the result of the roll immediately. Do not ask \"what do you do?\" after every sentence. Let the scene breathe.\n\n" +
    "Formatting Rules:\n\n" +
    "Use Bold for key items, enemies, or locations.\n\n" +
    "Use Italics for internal monologues or whispers.\n\n" +
    "Use > Blockquotes for reading letters or inscriptions.\n\n" +
    "Important: Never break character. Never say \"As an AI language model.\"\n\n" +
    "Combat Logic (The \"Hit\" System):\n\n" +
    "Do not track exact HP for enemies. Use \"Hits\".\n\n" +
    "Minions die in 1-2 successful hits.\n\n" +
    "Bosses take 5-10 successful hits.\n\n" +
    "Describe damage viscerally (\"The goblin's armor cracks under your blow\") rather than numerically.\n\n" +
    "Current Context:\n\n" +
    "The Party: {{insert_party_json_here}}\n\n" +
    "Campaign Tone: Dark Fantasy / High Stakes.\n\n" +
    `Party roster: ${partySummary}.\n` +
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
  const { roomCode, playerName, prompt } = (await request.json()) as {
    roomCode?: string;
    playerName?: string;
    prompt?: string;
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

  const partyJson = JSON.stringify(
    party.map((member) => ({
      name: member.playerName,
      class: member.className,
      hp: member.hp
    }))
  );

  const campaignSummary =
    room?.summary?.trim() || "No campaign summary yet";

  await convex.mutation(api.rooms.setDmActive, {
    roomCode,
    active: true
  });

  let result;
  try {
    result = await streamText({
      model: openai("gpt-4o-mini") as unknown as LanguageModelV1,
      system: buildDungeonMasterPrompt(partySummary, campaignSummary).replace(
        "{{insert_party_json_here}}",
        partyJson
      ),
      messages: prompt
        ? [...messages, { role: "user", content: prompt }]
        : messages
    });
  } catch (err) {
    await convex.mutation(api.rooms.setDmActive, {
      roomCode,
      active: false
    });
    throw err;
  }

  void result.text
    .then(async (text) => {
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
    })
    .finally(() => {
      void convex.mutation(api.rooms.setDmActive, {
        roomCode,
        active: false
      });
    });

  return result.toTextStreamResponse();
}
