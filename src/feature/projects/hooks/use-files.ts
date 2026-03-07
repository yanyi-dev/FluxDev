import { useMutation, useQuery } from "convex/react";
import { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";

// 为了和后端 Convex 里的 查询函数返回结果对齐
const sortFiles = <T extends { type: "file" | "folder"; name: string }>(
  files: T[],
) => {
  return [...files].sort((a, b) => {
    if (a.type === "folder" && b.type === "file") return -1;
    if (a.type === "file" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name);
  });
};

// 声明式查询，随组件渲染一直进行，所以可能有null的情况，需跳过处理
export const useFile = (fileId: Id<"files"> | null) => {
  return useQuery(api.files.getFile, fileId ? { id: fileId } : "skip");
};

export const useFiles = (projectId: Id<"projects"> | null) => {
  return useQuery(api.files.getFiles, projectId ? { projectId } : "skip");
};

export const useFilePath = (fileId: Id<"files"> | null) => {
  return useQuery(api.files.getFilePath, fileId ? { id: fileId } : "skip");
};

export const useCreateFile = () => {
  return useMutation(api.files.createFile).withOptimisticUpdate(
    (localStore, args) => {
      const existingFiles = localStore.getQuery(api.files.getFolderContents, {
        projectId: args.projectId,
        parentId: args.parentId,
      });

      if (existingFiles !== undefined) {
        // eslint-disable-next-line react-hooks/purity -- 乐观更新的回调函数在发送请求时运行，而不是在render阶段
        const now = Date.now();
        const newFile = {
          _id: crypto.randomUUID() as Id<"files">,
          _creationTime: now,
          projectId: args.projectId,
          parentId: args.parentId,
          name: args.name,
          content: args.content,
          type: "file" as const,
          updatedAt: now,
        };

        localStore.setQuery(
          api.files.getFolderContents,
          { projectId: args.projectId, parentId: args.parentId },
          sortFiles([...existingFiles, newFile]),
        );
      }
    },
  );
};

export const useUpdateFile = () => {
  return useMutation(api.files.updateFile);
};

export const useRenameFile = ({
  projectId,
  parentId,
}: {
  projectId: Id<"projects">;
  parentId?: Id<"files">;
}) => {
  return useMutation(api.files.renameFile).withOptimisticUpdate(
    (localStore, args) => {
      const existingFiles = localStore.getQuery(api.files.getFolderContents, {
        projectId,
        parentId,
      });

      if (existingFiles !== undefined) {
        const updatedFiles = existingFiles.map((file) =>
          file._id === args.id ? { ...file, name: args.newName } : file,
        );

        localStore.setQuery(
          api.files.getFolderContents,
          { projectId, parentId },
          sortFiles(updatedFiles),
        );
      }
    },
  );
};

export const useDeleteFile = ({
  projectId,
  parentId,
}: {
  projectId: Id<"projects">;
  parentId?: Id<"files">;
}) => {
  return useMutation(api.files.deleteFile).withOptimisticUpdate(
    (localStore, args) => {
      const existingFiles = localStore.getQuery(api.files.getFolderContents, {
        projectId,
        parentId,
      });

      if (existingFiles !== undefined) {
        localStore.setQuery(
          api.files.getFolderContents,
          { projectId, parentId },
          existingFiles.filter((file) => file._id !== args.id),
        );
      }
    },
  );
};

export const useCreateFolder = () => {
  return useMutation(api.files.createFolder).withOptimisticUpdate(
    (localStore, args) => {
      const existingFiles = localStore.getQuery(api.files.getFolderContents, {
        projectId: args.projectId,
        parentId: args.parentId,
      });

      if (existingFiles !== undefined) {
        // eslint-disable-next-line react-hooks/purity -- 乐观更新的回调函数在发送请求时运行，而不是在render阶段
        const now = Date.now();
        const newFolder = {
          _id: crypto.randomUUID() as Id<"files">,
          _creationTime: now,
          projectId: args.projectId,
          parentId: args.parentId,
          name: args.name,
          type: "folder" as const,
          updatedAt: now,
        };

        localStore.setQuery(
          api.files.getFolderContents,
          { projectId: args.projectId, parentId: args.parentId },
          sortFiles([...existingFiles, newFolder]),
        );
      }
    },
  );
};

// enabled表示文件夹展开才会加载内容
export const useFolderContents = ({
  projectId,
  parentId,
  enabled,
}: {
  projectId: Id<"projects">;
  parentId?: Id<"files">;
  enabled?: boolean;
}) => {
  return useQuery(
    api.files.getFolderContents,
    enabled ? { projectId, parentId } : "skip",
  );
};
