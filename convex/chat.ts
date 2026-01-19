import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const sendMessage = mutation({
  args: {
    content: v.string(),
    sender: v.string(),
    type: v.union(v.literal("chat"), v.literal("roll"), v.literal("system_alert"))
  },
  handler: async (ctx, args) => {
    const content = args.content.trim();
    if (!content) {
      return;
    }

    await ctx.db.insert("messages", {
      content,
      sender: args.sender.trim(),
      type: args.type,
      timestamp: Date.now()
    });
  }
});

export const getMessages = query({
  args: {},
  handler: async (ctx) => {
    const recent = await ctx.db
      .query("messages")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);

    return recent.reverse();
  }
});
