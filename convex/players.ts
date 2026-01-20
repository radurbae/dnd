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

export const getMyCharacter = query({
  args: {
    roomCode: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return ctx.db
      .query("players")
      .withIndex("by_room_user", (q) =>
        q.eq("roomCode", args.roomCode).eq("userId", identity.subject)
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

export const createCharacter = mutation({
  args: {
    roomCode: v.string(),
    playerName: v.string(),
    className: v.string(),
    hp: v.number(),
    inventory: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated.");
    }

    const trimmedName = args.playerName.trim();
    const trimmedClass = args.className.trim();
    const trimmedInventory = args.inventory.trim();

    if (!trimmedName) {
      throw new Error("Player name is required.");
    }

    const payload = {
      roomCode: args.roomCode,
      userId: identity.subject,
      playerName: trimmedName,
      className: trimmedClass || "Adventurer",
      hp: Math.max(0, Math.floor(args.hp)),
      inventory: trimmedInventory,
      updatedAt: Date.now()
    };

    return ctx.db.insert("players", payload);
  }
});

export const upsert = mutation({
  args: {
    roomCode: v.string(),
    playerName: v.string(),
    className: v.string(),
    hp: v.number(),
    inventory: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated.");
    }

    const trimmedName = args.playerName.trim();
    const trimmedClass = args.className.trim();
    const trimmedInventory = args.inventory.trim();

    if (!trimmedName) {
      throw new Error("Player name is required.");
    }

    const existing = await ctx.db
      .query("players")
      .withIndex("by_room_user", (q) =>
        q.eq("roomCode", args.roomCode).eq("userId", identity.subject)
      )
      .first();

    const payload = {
      roomCode: args.roomCode,
      userId: identity.subject,
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
