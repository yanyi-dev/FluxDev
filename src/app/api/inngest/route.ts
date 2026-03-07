import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

import { processMessage } from "@/feature/conversations/inngest/process-message";
import { generateTitle } from "@/feature/conversations/inngest/generate-title";
import { exportToGithub } from "@/feature/projects/inngest/export-to-github";
import { importGithubRepo } from "@/feature/projects/inngest/import-github-repo";

// Create an API that serves zero functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processMessage, generateTitle, exportToGithub, importGithubRepo],
});
