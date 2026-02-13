import { FileSystemTree } from "@webcontainer/api";

import { Doc, Id } from "../../../../convex/_generated/dataModel";

type FileDoc = Doc<"files">;

// 将扁平的convex文件结构变成webcontainer需要的文件结构
export const buildFileTree = (files: FileDoc[]): FileSystemTree => {
  const tree: FileSystemTree = {};
  // 创建id与文件的映射，简化父文件夹的查找
  const filesMap = new Map(files.map((f) => [f._id, f]));
  // 获取单个文件路径数组
  const getPath = (file: FileDoc): string[] => {
    const parts: string[] = [file.name];
    let parentId = file.parentId;

    while (parentId) {
      const parent = filesMap.get(parentId);
      if (!parent) break;
      parts.unshift(parent.name);
      parentId = parent.parentId;
    }

    return parts;
  };

  for (const file of files) {
    const pathParts = getPath(file);
    let current = tree;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      // 文件只可能是part的最后一个元素
      // part的最后一个元素即可能是文件又可能是文件夹
      const isLast = i === pathParts.length - 1;

      if (isLast) {
        if (file.type === "folder") {
          current[part] = { directory: {} };
        } else if (!file.storageId && file.content !== undefined) {
          current[part] = { file: { contents: file.content } };
        }
      } else {
        if (!current[part]) {
          current[part] = { directory: {} };
        }

        const node = current[part];
        // 类型校验，并防止脏数据
        if ("directory" in node) {
          current = node.directory;
        }
      }
    }
  }

  return tree;
};

// 获取单个文件路径字符串
export const getFilePath = (
  file: FileDoc,
  filesMap: Map<Id<"files">, FileDoc>,
): string => {
  const parts: string[] = [file.name];
  let parentId = file.parentId;

  while (parentId) {
    const parent = filesMap.get(parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    parentId = parent.parentId;
  }

  return parts.join("/");
};
