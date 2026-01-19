import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  players: defineTable({
    name: v.string(),
    class: v.string(),
    hp: v.number(),
    maxHp: v.number(),
    inventory: v.array(v.string())
  }),
  messages: defineTable({
    content: v.string(),
    sender: v.string(),
    type: v.union(v.literal("chat"), v.literal("roll"), v.literal("system_alert")),
    timestamp: v.number()
  }).index("by_timestamp", ["timestamp"])
});
