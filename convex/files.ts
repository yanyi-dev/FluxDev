import { v } from "convex/values";

import { query, mutation } from "./_generated/server";
import { verifyAuth } from "./auth";
import { Doc, Id } from "./_generated/dataModel";

// 获取项目下所有内容
export const getFiles = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);

    if (!project) throw new Error("Project not found");

    if (project.ownerId !== identity.subject)
      throw new Error("Unauthorized access to this project");

    return ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// 获取单个文件
export const getFile = query({
  args: { id: v.id("files") },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get(args.id);

    if (!file) throw new Error("File not found");

    const project = await ctx.db.get("projects", file.projectId);

    if (!project) throw new Error("Project not found");
    if (project.ownerId !== identity.subject)
      throw new Error("Unauthorized access to this project");

    return file;
  },
});

// 获取文件路径，返回的是一个文件数组{ _id: string; name: string }[]
// 获取路径逻辑可优化
export const getFilePath = query({
  args: { id: v.id("files") },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get(args.id);

    if (!file) throw new Error("File not found");

    const project = await ctx.db.get("projects", file.projectId);

    if (!project) throw new Error("project not found");

    if (project.ownerId !== identity.subject)
      throw new Error("Unauthorized access to this project");

    const path: { _id: string; name: string }[] = [];
    let currentId: Id<"files"> | undefined = args.id;
    while (currentId) {
      const file = (await ctx.db.get(
        "files",
        currentId,
      )) as Doc<"files"> | null;
      if (!file) break;
      path.unshift({ _id: file._id, name: file.name });
      currentId = file.parentId;
    }
    return path;
  },
});

//获取特定文件夹下的内容
export const getFolderContents = query({
  args: { projectId: v.id("projects"), parentId: v.optional(v.id("files")) },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);

    if (!project) throw new Error("Project not found");

    if (project.ownerId !== identity.subject)
      throw new Error("Unauthorized access to this project");

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId),
      )
      .collect();

    // 文件夹在前，文件在后
    return files.sort((a, b) => {
      if (a.type === "folder" && b.type === "file") return -1;
      if (a.type === "file" && b.type === "folder") return 1;

      // 同类型，按名字排序
      return a.name.localeCompare(b.name);
    });
  },
});

export const createFile = mutation({
  args: {
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
    name: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);

    if (!project) throw new Error("Project not found");

    if (project.ownerId !== identity.subject)
      throw new Error("Unauthorized access to this project");

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId),
      )
      .collect();

    // 同名文件检查
    const existing = files.find(
      (file) => file.name === args.name && file.type === "file",
    );

    if (existing) throw new Error("File already exists");

    const now = Date.now();

    await ctx.db.insert("files", {
      name: args.name,
      type: "file",
      updatedAt: now,
      projectId: args.projectId,
      parentId: args.parentId,
      content: args.content,
    });

    await ctx.db.patch("projects", args.projectId, {
      updatedAt: now,
    });
  },
});

export const createFolder = mutation({
  args: {
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);

    if (!project) throw new Error("Project not found");

    if (project.ownerId !== identity.subject)
      throw new Error("Unauthorized access to this project");

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId),
      )
      .collect();

    // 同名文件夹检查
    const existing = files.find(
      (file) => file.name === args.name && file.type === "folder",
    );

    if (existing) throw new Error("Folder already exists");

    const now = Date.now();

    await ctx.db.insert("files", {
      name: args.name,
      type: "folder",
      updatedAt: now,
      projectId: args.projectId,
      parentId: args.parentId,
    });

    await ctx.db.patch("projects", args.projectId, {
      updatedAt: now,
    });
  },
});

// 重命名文件或文件夹
export const renameFile = mutation({
  args: {
    newName: v.string(),
    id: v.id("files"),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);

    if (!file) throw new Error("Item not found");

    const project = await ctx.db.get("projects", file.projectId);

    if (!project) throw new Error("Project not found");

    if (project.ownerId !== identity.subject)
      throw new Error("Unauthorized access to this project");

    // 判断是否存在同名同级文件
    const siblings = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", file.projectId).eq("parentId", file.parentId),
      )
      .collect();

    //会查到自己，要剔除
    const existing = siblings.find(
      (sibling) =>
        sibling.name === args.newName &&
        sibling.type === file.type &&
        sibling._id !== args.id,
    );

    if (existing)
      throw new Error(
        `A ${file.type} with this name already exists in this project`,
      );

    const now = Date.now();

    await ctx.db.patch("files", args.id, {
      name: args.newName,
      updatedAt: now,
    });

    await ctx.db.patch("projects", file.projectId, {
      updatedAt: now,
    });
  },
});

// 删除文件或文件夹
export const deleteFile = mutation({
  args: {
    id: v.id("files"),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);

    if (!file) throw new Error("Item not found");

    const project = await ctx.db.get("projects", file.projectId);

    if (!project) throw new Error("Project not found");

    if (project.ownerId !== identity.subject)
      throw new Error("Unauthorized access to this project");

    const deleteRecursive = async (flieId: Id<"files">) => {
      const item = await ctx.db.get("files", flieId);

      if (!item) return;

      // 递归删除文件夹所有内容
      if (item.type === "folder") {
        const children = await ctx.db
          .query("files")
          .withIndex("by_parent", (q) => q.eq("parentId", flieId))
          .collect();

        for (const child of children) {
          await deleteRecursive(child._id);
        }
      }

      if (item.storageId) await ctx.storage.delete(item.storageId);
      await ctx.db.delete(flieId);
    };

    await deleteRecursive(args.id);

    await ctx.db.patch("projects", file.projectId, {
      updatedAt: Date.now(),
    });
  },
});

// 更新文本文件内容
export const updateFile = mutation({
  args: {
    id: v.id("files"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);

    if (!file) throw new Error("Item not found");

    if (file.type !== "file" || file.storageId) {
      throw new Error("Can only update content of text files");
    }

    const project = await ctx.db.get("projects", file.projectId);

    if (!project) throw new Error("Project not found");

    if (project.ownerId !== identity.subject)
      throw new Error("Unauthorized access to this project");

    const now = Date.now();

    await ctx.db.patch("files", args.id, {
      content: args.content,
      updatedAt: now,
    });

    await ctx.db.patch("projects", file.projectId, {
      updatedAt: now,
    });
  },
});
