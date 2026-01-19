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
      turnMode: false
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

    return { participantId, roomCode };
  }
});

export const leaveRoom = mutation({
  args: {
    participantId: v.id("participants")
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.participantId);
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
