import { z } from "zod";
import { createTool } from "@inngest/agent-kit";

import { convex } from "@/lib/convex-client";

import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

interface ReadFilesToolOptions {
  internalKey: string;
}

const paramsSchema = z.object({
  fileIds: z
    .array(z.string().min(1, "File ID cannot be empty"))
    .min(1, "Provide at least one file ID"),
});

export const createReadFilesTool = ({ internalKey }: ReadFilesToolOptions) => {
  return createTool({
    name: "readFiles",
    description:
      "Read the content of files from the project. Returns file contents.",
    // Tools的参数一般是个对象
    parameters: z.object({
      fileIds: z.array(z.string()).describe("Array of file IDs to read"),
    }),
    // params是ai模型传入的参数，根据tools参数定义生成
    handler: async (params, { step: toolStep }) => {
      const parsed = paramsSchema.safeParse(params);
      if (!parsed.success) return `Error: ${parsed.error.issues[0].message}`;

      const { fileIds } = parsed.data;

      try {
        return await toolStep?.run("read-files", async () => {
          const results: { id: string; name: string; content: string }[] = [];

          for (const fileId of fileIds) {
            const file = await convex.query(api.system.getFileById, {
              internalKey,
              fileId: fileId as Id<"files">,
            });

            if (!file) {
              results.push({
                id: fileId,
                name: "Unknown",
                content: "[ERROR] File not found or access denied.",
              });
              continue;
            }
            if (!file.content) {
              results.push({
                id: fileId,
                name: file.name,
                content: "[INFO] File is empty.",
              });
              continue;
            }

            results.push({
              id: fileId,
              name: file.name,
              content: file.content,
            });
          }

          if (results.length === 0)
            return "Error: No files found with provided IDs. Use listFiles to get valid fileIDs.";

          return JSON.stringify(results);
        });
      } catch (error) {
        return `Error reading files: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
};
