import { useMutation, useQuery } from "convex/react";
import { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";

export const useCreateFile = () => {
  return useMutation(api.files.createFile);
};

export const useRenameFile = () => {
  return useMutation(api.files.renameFile);
};

export const useDeleteFile = () => {
  return useMutation(api.files.deleteFile);
};

export const useCreateFolder = () => {
  return useMutation(api.files.createFolder);
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
