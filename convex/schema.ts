import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

//整个项目的数据库模式，在里面定义表
//为项目提供数据校验和类型安全
export default defineSchema({
  projects: defineTable({
    name: v.string(),
    ownerId: v.string(),
    updatedAt: v.number(),
    importStatus: v.optional(
      v.union(
        v.literal("importing"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),
    exportStatus: v.optional(
      v.union(
        v.literal("exporting"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("failed"),
      ),
    ),
    exportRepoUrl: v.optional(v.string()),
  }).index("by_owner", ["ownerId"]),
});
