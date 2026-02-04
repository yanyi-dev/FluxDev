import { generateText } from "ai";
import { inngest } from "./client";
import { deepseek } from "@/lib/ai";

const URL_REGEX = /https?:\/\/[^\s]+(?<![.,!?;:])/g;

export const demoGenerate = inngest.createFunction(
  { id: "demoGenerate" },
  { event: "demo/generate" },
  async ({ event, step }) => {
    const { prompt } = event.data as { prompt: string };

    const urls = (await step.run("extract-urls", async () => {
      return prompt.match(URL_REGEX) || [];
    })) as string[];

    const scrapedContent = await step.run("scrape-urls", async () => {
      const results = await Promise.all(
        urls.map(async (url) => {
          const result = await fetch(`https://r.jina.ai/${url}`, {
            method: "GET",
            headers: {
              // "Authorization": `Bearer ${process.env.JINA_API_KEY}`
              "X-Return-Format": "markdown",
            },
          });

          if (!result.ok) {
            throw new Error(`Jina API status: ${result.status}`);
          }

          return await result.text();
        }),
      );
      return results.filter(Boolean).join("\n\n");
    });

    const finalPrompt = scrapedContent
      ? `Context:\n${scrapedContent}\n\nQuestions: ${prompt}`
      : prompt;

    await step.run("generate-text", async () => {
      return await generateText({
        model: deepseek(),
        prompt: finalPrompt,
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true,
        },
      });
    });
  },
);
