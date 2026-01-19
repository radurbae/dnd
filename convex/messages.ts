import { mutation, query } from "convex/server";
import { v } from "convex/values";

export const list = query({
  args: {
    roomCode: v.string()
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("messages")
      .withIndex("by_room_time", (q) => q.eq("roomCode", args.roomCode))
      .collect();
  }
});

export const listRecent = query({
  args: {
    roomCode: v.string()
  },
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("messages")
      .withIndex("by_room_time", (q) => q.eq("roomCode", args.roomCode))
      .order("desc")
      .take(10);

    return recent.reverse();
  }
});

export const listRecentLimit = query({
  args: {
    roomCode: v.string(),
    limit: v.number()
  },
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("messages")
      .withIndex("by_room_time", (q) => q.eq("roomCode", args.roomCode))
      .order("desc")
      .take(args.limit);

    return recent.reverse();
  }
});

export const send = mutation({
  args: {
    roomCode: v.string(),
    playerName: v.string(),
    body: v.string(),
    kind: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.roomCode))
      .first();

    if (!room) {
      throw new Error("Room not found.");
    }

    const body = args.body.trim();
    if (!body) {
      return { messageCount: room.messageCount, needsSummary: false };
    }

    await ctx.db.insert("messages", {
      roomCode: args.roomCode,
      playerName: args.playerName,
      kind: args.kind ?? "chat",
      body,
      createdAt: Date.now()
    });

    const messageCount = room.messageCount + 1;
    const needsSummary =
      messageCount % 20 === 0 && messageCount > room.summaryCount;

    await ctx.db.patch(room._id, {
      messageCount
    });

    return { messageCount, needsSummary };
  }
});
