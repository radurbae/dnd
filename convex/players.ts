import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByRoomAndUser = query({
  args: {
    roomCode: v.string(),
    userId: v.string()
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("players")
      .withIndex("by_room_user", (q) =>
        q.eq("roomCode", args.roomCode).eq("userId", args.userId)
      )
      .first();
  }
});

export const listByRoom = query({
  args: {
    roomCode: v.string()
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomCode", args.roomCode))
      .collect();
  }
});

export const upsert = mutation({
  args: {
    roomCode: v.string(),
    userId: v.string(),
    playerName: v.string(),
    className: v.string(),
    hp: v.number(),
    inventory: v.string()
  },
  handler: async (ctx, args) => {
    const trimmedName = args.playerName.trim();
    const trimmedClass = args.className.trim();
    const trimmedInventory = args.inventory.trim();

    if (!trimmedName) {
      throw new Error("Player name is required.");
    }

    const existing = await ctx.db
      .query("players")
      .withIndex("by_room_user", (q) =>
        q.eq("roomCode", args.roomCode).eq("userId", args.userId)
      )
      .first();

    const payload = {
      roomCode: args.roomCode,
      userId: args.userId,
      playerName: trimmedName,
      className: trimmedClass || "Adventurer",
      hp: Math.max(0, Math.floor(args.hp)),
      inventory: trimmedInventory,
      updatedAt: Date.now()
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return ctx.db.insert("players", payload);
  }
});
