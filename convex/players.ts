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

export const getMyByRoom = query({
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated.");
    }

    return ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomCode", args.roomCode))
      .collect();
  }
});

export const listByRoomPublic = query({
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

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated.");
    }

    return ctx.db
      .query("players")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  }
});

export const createCharacter = mutation({
  args: {
    roomCode: v.string(),
    playerName: v.string(),
    race: v.string(),
    strength: v.number(),
    dexterity: v.number(),
    intelligence: v.number(),
    status: v.string(),
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

    if (existing) {
      throw new Error("Character already exists.");
    }

    const payload = {
      roomCode: args.roomCode,
      userId: identity.subject,
      playerName: trimmedName,
      race: args.race,
      strength: args.strength,
      dexterity: args.dexterity,
      intelligence: args.intelligence,
      status: args.status,
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
    race: v.string(),
    strength: v.number(),
    dexterity: v.number(),
    intelligence: v.number(),
    status: v.string(),
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
      race: args.race,
      strength: args.strength,
      dexterity: args.dexterity,
      intelligence: args.intelligence,
      status: args.status,
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

export const applyDamageByName = mutation({
  args: {
    roomCode: v.string(),
    playerName: v.string(),
    amount: v.number()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated.");
    }

    const amount = Math.max(0, Math.floor(args.amount));
    if (!amount) {
      return;
    }

    const player = await ctx.db
      .query("players")
      .withIndex("by_room_player", (q) =>
        q.eq("roomCode", args.roomCode).eq("playerName", args.playerName)
      )
      .first();

    if (!player) {
      throw new Error("Player not found.");
    }

    await ctx.db.patch(player._id, {
      hp: Math.max(0, player.hp - amount),
      updatedAt: Date.now()
    });
  }
});
