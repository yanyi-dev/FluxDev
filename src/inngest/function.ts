import { generateText } from "ai";
import { inngest } from "./client";
import { deepseek } from "@/lib/ai";

export const demoGenerate = inngest.createFunction(
  { id: "demoGenerate" },
  { event: "demo/generate" },
  async ({ step }) => {
    await step.run("generate-text", async () => {
      return await generateText({
        model: deepseek(),
        prompt: "用一句话介绍你自己",
      });
    });
  },
);
