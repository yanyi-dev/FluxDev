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
    settings: v.optional(
      v.object({
        installCommand: v.optional(v.string()),
        devCommand: v.optional(v.string()),
      }),
    ),
  }).index("by_owner", ["ownerId"]),

  // 业务逻辑上，文件夹，文件，二进制文件互斥
  // 实际上，定义是糅合在一起了的
  // 注意在后端逻辑中区分
  files: defineTable({
    name: v.string(),
    type: v.union(v.literal("file"), v.literal("folder")),
    updatedAt: v.number(),
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
    content: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  })
    .index("by_project", ["projectId"])
    .index("by_parent", ["parentId"])
    .index("by_project_parent", ["projectId", "parentId"]),

  // 即一个对话，一个项目多个对话
  conversations: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  // 即一条消息，一个对话多条消息
  // 可以是用户发出的，也可以是ai发出的
  messages: defineTable({
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
  })
    .index("by_conversation", ["conversationsId"])
    .index("by_project_status", ["projectId", "status"]),
});
