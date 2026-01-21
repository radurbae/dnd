import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9
};

const STAT_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

function statCost(score: number) {
  return POINT_BUY_COST[score] ?? Infinity;
}

function validatePointBuy(stats: Record<(typeof STAT_KEYS)[number], number>) {
  const total = STAT_KEYS.reduce((sum, key) => sum + statCost(stats[key]), 0);
  const allValid = STAT_KEYS.every((key) => {
    const value = stats[key];
    return Number.isFinite(value) && value >= 8 && value <= 15;
  });
  return { total, allValid };
}

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
    characterName: v.string(),
    gender: v.string(),
    race: v.string(),
    stats: v.object({
      str: v.number(),
      dex: v.number(),
      con: v.number(),
      int: v.number(),
      wis: v.number(),
      cha: v.number()
    }),
    status: v.string(),
    className: v.string(),
    hp: v.number(),
    skills: v.array(v.string()),
    backstory: v.string(),
    equipment: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        quantity: v.number()
      })
    )
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated.");
    }

    const trimmedName = args.playerName.trim();
    const trimmedCharacterName = args.characterName.trim();
    const trimmedGender = args.gender.trim();
    const trimmedClass = args.className.trim();
    const trimmedBackstory = args.backstory.trim();

    if (!trimmedName) {
      throw new Error("Player name is required.");
    }
    if (!trimmedCharacterName) {
      throw new Error("Character name is required.");
    }
    if (!trimmedGender) {
      throw new Error("Gender is required.");
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

    const { total, allValid } = validatePointBuy(args.stats);
    if (!allValid || total > 27) {
      throw new Error("Stats do not match the point buy rules.");
    }

    const payload = {
      roomCode: args.roomCode,
      userId: identity.subject,
      playerName: trimmedName,
      characterName: trimmedCharacterName,
      gender: trimmedGender,
      race: args.race,
      stats: args.stats,
      status: args.status,
      className: trimmedClass || "Adventurer",
      hp: Math.max(0, Math.floor(args.hp)),
      skills: args.skills.map((skill) => skill.trim()).filter(Boolean),
      backstory: trimmedBackstory,
      equipment: args.equipment.map((item) => ({
        name: item.name.trim(),
        type: item.type.trim(),
        quantity: Math.max(1, Math.floor(item.quantity))
      })),
      updatedAt: Date.now()
    };

    return ctx.db.insert("players", payload);
  }
});

export const upsert = mutation({
  args: {
    roomCode: v.string(),
    playerName: v.string(),
    characterName: v.string(),
    gender: v.string(),
    race: v.string(),
    stats: v.object({
      str: v.number(),
      dex: v.number(),
      con: v.number(),
      int: v.number(),
      wis: v.number(),
      cha: v.number()
    }),
    status: v.string(),
    className: v.string(),
    hp: v.number(),
    skills: v.array(v.string()),
    backstory: v.string(),
    equipment: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        quantity: v.number()
      })
    )
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated.");
    }

    const trimmedName = args.playerName.trim();
    const trimmedCharacterName = args.characterName.trim();
    const trimmedGender = args.gender.trim();
    const trimmedClass = args.className.trim();
    const trimmedBackstory = args.backstory.trim();

    if (!trimmedName) {
      throw new Error("Player name is required.");
    }
    if (!trimmedCharacterName) {
      throw new Error("Character name is required.");
    }
    if (!trimmedGender) {
      throw new Error("Gender is required.");
    }

    const existing = await ctx.db
      .query("players")
      .withIndex("by_room_user", (q) =>
        q.eq("roomCode", args.roomCode).eq("userId", identity.subject)
      )
      .first();

    const { total, allValid } = validatePointBuy(args.stats);
    if (!allValid || total > 27) {
      throw new Error("Stats do not match the point buy rules.");
    }

    const payload = {
      roomCode: args.roomCode,
      userId: identity.subject,
      playerName: trimmedName,
      characterName: trimmedCharacterName,
      gender: trimmedGender,
      race: args.race,
      stats: args.stats,
      status: args.status,
      className: trimmedClass || "Adventurer",
      hp: Math.max(0, Math.floor(args.hp)),
      skills: args.skills.map((skill) => skill.trim()).filter(Boolean),
      backstory: trimmedBackstory,
      equipment: args.equipment.map((item) => ({
        name: item.name.trim(),
        type: item.type.trim(),
        quantity: Math.max(1, Math.floor(item.quantity))
      })),
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
