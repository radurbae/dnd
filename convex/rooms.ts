import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const CODE_LENGTH = 6;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    code += CODE_ALPHABET[idx];
  }
  return code;
}

const PROLOGS = [
  "The mists lift to reveal a forgotten vale of basalt spires and emberlit ruins.",
  "A silver storm hangs over the coast, and every wave whispers a name.",
  "Deep beneath the trade roads, a vault of singing stone wakes from its long sleep.",
  "The kingdom's last lighthouse burns green tonight, calling travelers toward the shoals.",
  "A city of brass gears turns for the first time in a century, and the streets hum."
];

const THREATS = [
  "A pact-bound warband marches under a broken banner.",
  "Something ancient stirs beneath the catacombs, rattling the saints' bones.",
  "A jealous archmage has sealed the sun in a mirrored sky.",
  "The forest has begun to move, one rooted step at a time.",
  "A masked tribunal searches for a stolen relic that can rewrite fate."
];

const HOOKS = [
  "A courier collapses at your feet with a map burned into their palm.",
  "The innkeeper offers you free rooms if you investigate the lights in the marsh.",
  "A child's song names each of you and the road you must walk.",
  "An old rival arrives with a sealed letter from the crown.",
  "A caravan master begs for protection on a cursed crossing."
];

function generateProlog() {
  const prolog = PROLOGS[Math.floor(Math.random() * PROLOGS.length)];
  const threat = THREATS[Math.floor(Math.random() * THREATS.length)];
  const hook = HOOKS[Math.floor(Math.random() * HOOKS.length)];
  return `${prolog} ${threat} ${hook}`;
}

export const createRoom = mutation({
  args: {
    leaderName: v.string()
  },
  handler: async (ctx, args) => {
    const leaderName = args.leaderName.trim();
    if (!leaderName) {
      throw new Error("Leader name is required.");
    }

    let code = generateRoomCode();
    let existing = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      existing = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!existing) {
        break;
      }
      code = generateRoomCode();
    }

    if (existing) {
      throw new Error("Unable to allocate a room code. Try again.");
    }

    await ctx.db.insert("rooms", {
      code,
      createdAt: Date.now(),
      messageCount: 0,
      summaryCount: 0,
      summary: "",
      leaderName,
      turnMode: false,
      status: "lobby"
    });

    const prolog = generateProlog();
    await ctx.db.insert("messages", {
      roomCode: code,
      playerName: "World",
      kind: "system",
      body: prolog,
      createdAt: Date.now()
    });

    await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first()
      .then((room) => {
        if (room) {
          return ctx.db.patch(room._id, { messageCount: 1 });
        }
      });

    return { code };
  }
});

export const joinRoom = mutation({
  args: {
    roomCode: v.string(),
    playerName: v.string()
  },
  handler: async (ctx, args) => {
    const roomCode = args.roomCode.trim().toUpperCase();
    const playerName = args.playerName.trim();
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", roomCode))
      .first();

    if (!room) {
      throw new Error("Room not found.");
    }

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_room", (q) => q.eq("roomCode", roomCode))
      .collect();

    if (participants.length >= 4) {
      throw new Error("Room is full.");
    }

    if (!playerName) {
      throw new Error("Player name is required.");
    }

    const participantId = await ctx.db.insert("participants", {
      roomCode,
      playerName,
      joinedAt: Date.now()
    });

    await ctx.db.insert("messages", {
      roomCode,
      playerName: "System",
      kind: "system",
      body: `${playerName} joined the room.`,
      createdAt: Date.now()
    });

    await ctx.db.patch(room._id, {
      messageCount: room.messageCount + 1
    });

    return { participantId, roomCode };
  }
});

export const leaveRoom = mutation({
  args: {
    participantId: v.id("participants")
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      return;
    }

    await ctx.db.delete(args.participantId);

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", participant.roomCode))
      .first();

    if (!room) {
      return;
    }

    await ctx.db.insert("messages", {
      roomCode: participant.roomCode,
      playerName: "System",
      kind: "system",
      body: `${participant.playerName} left the room.`,
      createdAt: Date.now()
    });

    await ctx.db.patch(room._id, {
      messageCount: room.messageCount + 1
    });
  }
});

export const listParticipants = query({
  args: {
    roomCode: v.string()
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("participants")
      .withIndex("by_room", (q) => q.eq("roomCode", args.roomCode))
      .collect();
  }
});

export const getByCode = query({
  args: {
    roomCode: v.string()
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.roomCode))
      .first();
  }
});

export const updateSummary = mutation({
  args: {
    roomCode: v.string(),
    summary: v.string(),
    summaryCount: v.number()
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.roomCode))
      .first();

    if (!room) {
      throw new Error("Room not found.");
    }

    await ctx.db.patch(room._id, {
      summary: args.summary,
      summaryCount: args.summaryCount
    });
  }
});

export const setTurnMode = mutation({
  args: {
    roomCode: v.string(),
    leaderName: v.string(),
    enabled: v.boolean()
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.roomCode))
      .first();

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.leaderName !== args.leaderName) {
      throw new Error("Only the party leader can change Turn Mode.");
    }

    await ctx.db.patch(room._id, {
      turnMode: args.enabled
    });
  }
});

export const startAdventure = mutation({
  args: {
    roomCode: v.string(),
    leaderName: v.string()
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.roomCode))
      .first();

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.leaderName !== args.leaderName) {
      throw new Error("Only the party leader can start the adventure.");
    }

    await ctx.db.patch(room._id, { status: "playing" });
  }
});
