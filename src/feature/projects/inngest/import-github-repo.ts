import ky from "ky";
import { Octokit } from "octokit";
import { isBinaryFile } from "isbinaryfile";
import { NonRetriableError } from "inngest";

import { convex } from "@/lib/convex-client";
import { inngest } from "@/inngest/client";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

const BATCH_SIZE = 10;

interface ImportGithubRepoEvent {
  owner: string;
  repo: string;
  projectId: Id<"projects">;
  githubToken: string;
}

export const importGithubRepo = inngest.createFunction(
  {
    id: "import-github-repo",
    onFailure: async ({ event, step }) => {
      const internalKey = process.env.FLUXDEV_CONVEX_INTERNAL_KEY;
      if (!internalKey) return;

      const { projectId } = event.data.event.data as ImportGithubRepoEvent;

      await step.run("set-failed-status", async () => {
        await convex.mutation(api.system.updateImportStatus, {
          internalKey,
          projectId,
          status: "failed",
        });
      });
    },
  },
  { event: "github/import.repo" },
  async ({ event, step }) => {
    const { owner, repo, projectId, githubToken } =
      event.data as ImportGithubRepoEvent;

    const internalKey = process.env.FLUXDEV_CONVEX_INTERNAL_KEY;
    if (!internalKey)
      throw new NonRetriableError(
        "FLUXDEV_CONVEX_INTERNAL_KEY is not configure",
      );

    const octokit = new Octokit({ auth: githubToken });

    // 删除任何在本项目中存在的文件
    await step.run("cleanup-project", async () => {
      await convex.mutation(api.system.cleanup, {
        internalKey,
        projectId,
      });
    });

    const tree = await step.run("fetch-repo-tree", async () => {
      // 先获取准确默认分支再拉取
      const { data: repoInfo } = await octokit.rest.repos.get({
        owner,
        repo,
      });

      const branch = repoInfo.default_branch;
      const { data } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: branch,
        recursive: "1",
      });
      return data;
    });

    // 文件夹按照层级排序，父再前，子在后
    // Input:  [{ path: "src/components" }, { path: "src" }, { path: "src/components/ui" }]
    // Output: [{ path: "src" }, { path: "src/components" }, { path: "src/components/ui" }]
    const folders = tree.tree
      .filter((item) => item.type === "tree" && item.path)
      .sort((a, b) => {
        const aDepth = a.path ? a.path.split("/").length : 0;
        const bDepth = b.path ? b.path.split("/").length : 0;

        return aDepth - bDepth;
      });

    // step返回的内容需要被序列化，但map类型不行，故手动创建
    // 路径到id的映射
    const folderIdMap = await step.run("create-folders", async () => {
      const map: Record<string, Id<"files">> = {};

      for (const folder of folders) {
        if (!folder.path) {
          continue;
        }

        const pathParts = folder.path.split("/");
        const name = pathParts.pop()!;
        const parentPath = pathParts.join("/");
        const parentId = parentPath ? map[parentPath] : undefined;

        const folderId = await convex.mutation(api.system.createFolder, {
          internalKey,
          projectId,
          name,
          parentId,
        });

        map[folder.path] = folderId;
      }

      return map;
    });

    // sha即文件在Git里有有效索引
    const allFiles = tree.tree.filter(
      (item) => item.type === "blob" && item.path && item.sha,
    );

    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
      const batch = allFiles.slice(i, i + BATCH_SIZE);

      await step.run(`import-files-batch-${i}`, async () => {
        await Promise.all(
          batch.map(async (file) => {
            if (!file.path || !file.sha) return;

            const { data: blob } = await octokit.rest.git.getBlob({
              owner,
              repo,
              file_sha: file.sha,
            });

            // Github发过来的内容是base64字符串，解码成二进制数据
            const buffer = Buffer.from(blob.content, "base64");
            const isBinary = await isBinaryFile(buffer);

            const pathParts = file.path.split("/");
            const name = pathParts.pop()!;
            const parentPath = pathParts.join("/");
            const parentId = parentPath ? folderIdMap[parentPath] : undefined;

            if (isBinary) {
              const uploadUrl = await convex.mutation(
                api.system.generateUploadUrl,
                { internalKey },
              );

              const { storageId } = await ky
                .post(uploadUrl, {
                  headers: { "Content-Type": "application/octet-stream" },
                  body: buffer,
                })
                .json<{ storageId: Id<"_storage"> }>();

              await convex.mutation(api.system.createBinaryFile, {
                internalKey,
                projectId,
                name,
                storageId,
                parentId,
              });
            } else {
              const content = buffer.toString("utf-8");

              await convex.mutation(api.system.createFile, {
                internalKey,
                projectId,
                name,
                content,
                parentId,
              });
            }
          }),
        );
      });
    }

    await step.run("set-completed-status", async () => {
      await convex.mutation(api.system.updateImportStatus, {
        internalKey,
        projectId,
        status: "completed",
      });
    });

    return { success: true, projectId };
  },
);
