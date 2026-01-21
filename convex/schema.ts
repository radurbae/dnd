import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    createdAt: v.number(),
    messageCount: v.number(),
    summaryCount: v.number(),
    summary: v.string(),
    leaderName: v.string(),
    turnMode: v.boolean(),
    dmActive: v.optional(v.boolean()),
    status: v.optional(v.string())
  }).index("by_code", ["code"]),
  participants: defineTable({
    roomCode: v.string(),
    playerName: v.string(),
    joinedAt: v.number()
  }).index("by_room", ["roomCode", "joinedAt"]),
  players: defineTable({
    roomCode: v.string(),
    userId: v.string(),
    playerName: v.string(),
    characterName: v.optional(v.string()),
    gender: v.optional(v.string()),
    race: v.optional(v.string()),
    strength: v.optional(v.number()),
    dexterity: v.optional(v.number()),
    intelligence: v.optional(v.number()),
    status: v.optional(v.string()),
    className: v.string(),
    hp: v.number(),
    inventory: v.optional(v.string()),
    stats: v.optional(
      v.object({
        str: v.number(),
        dex: v.number(),
        con: v.number(),
        int: v.number(),
        wis: v.number(),
        cha: v.number()
      })
    ),
    skills: v.optional(v.array(v.string())),
    backstory: v.optional(v.string()),
    equipment: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.string(),
          quantity: v.number()
        })
      )
    ),
    updatedAt: v.number()
  })
    .index("by_room", ["roomCode", "updatedAt"])
    .index("by_room_player", ["roomCode", "playerName"])
    .index("by_room_user", ["roomCode", "userId"])
    .index("by_user", ["userId", "updatedAt"]),
  messages: defineTable({
    roomCode: v.string(),
    playerName: v.string(),
    kind: v.string(),
    body: v.string(),
    createdAt: v.number()
  }).index("by_room_time", ["roomCode", "createdAt"])
});
