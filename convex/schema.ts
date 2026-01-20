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
    status: v.string()
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
    race: v.string(),
    strength: v.number(),
    dexterity: v.number(),
    intelligence: v.number(),
    status: v.string(),
    className: v.string(),
    hp: v.number(),
    inventory: v.string(),
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
