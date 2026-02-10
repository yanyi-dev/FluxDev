import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const validateInternalKey = (key: string) => {
  const internalKey = process.env.FLUXDEV_CONVEX_INTERNAL_KEY;

  if (!internalKey) {
    throw new Error("FLUXDEV_CONVEX_INTERNAL_KEY is not configured");
  }

  if (internalKey !== key) {
    throw new Error("Invalid internal key");
  }
};

export const getConversationById = query({
  args: {
    conversationId: v.id("conversations"),
    internalKey: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);
    return await ctx.db.get("conversations", args.conversationId);
  },
});

export const createMessage = mutation({
  args: {
    internalKey: v.string(),
    conversationsId: v.id("conversations"),
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    status: v.optional(
      v.union(
        v.literal("processing"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const messageId = await ctx.db.insert("messages", {
      conversationsId: args.conversationsId,
      projectId: args.projectId,
      role: args.role,
      content: args.content,
      status: args.status,
    });

    await ctx.db.patch(args.conversationsId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

export const updateMessageContent = mutation({
  args: {
    internalKey: v.string(),
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    await ctx.db.patch(args.messageId, {
      content: args.content,
      status: "completed" as const,
    });
  },
});
