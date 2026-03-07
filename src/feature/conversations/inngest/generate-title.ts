import { createAgent, openai } from "@inngest/agent-kit";
import { NonRetriableError } from "inngest";

import { inngest } from "@/inngest/client";
import { convex } from "@/lib/convex-client";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { TITLE_GENERATOR_SYSTEM_PROMPT } from "./constants";

interface GenerateTitleEvent {
  conversationId: Id<"conversations">;
  message: string;
}

export const generateTitle = inngest.createFunction(
  { id: "generate-title" },
  { event: "conversation/generate-title" },
  async ({ event, step }) => {
    const { conversationId, message } = event.data as GenerateTitleEvent;
    const internalKey = process.env.FLUXDEV_CONVEX_INTERNAL_KEY;

    if (!internalKey) {
      throw new NonRetriableError("FLUXDEV_CONVEX_INTERNAL_KEY is not configured");
    }

    const titlePrompt = TITLE_GENERATOR_SYSTEM_PROMPT.replace(
      "{message}",
      message,
    );

    const titleAgent = createAgent({
      name: "title-generator",
      system: titlePrompt,
      model: openai({
        baseUrl: process.env.AGENT_BASE_URL,
        model:
          process.env.AGENT_TITLE_GENERATE_MODEL ??
          "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B",
        apiKey: process.env.AGENT_API_KEY,
      }),
    });

    const { output } = await titleAgent.run(message, { step });

    const textMessage = output.find(
      (m) => m.type === "text" && m.role === "assistant",
    );

    if (textMessage?.type === "text") {
      const title =
        typeof textMessage.content === "string"
          ? textMessage.content.trim()
          : textMessage.content
              .map((c) => c.text)
              .join("")
              .trim();

      if (title) {
        await step.run("update-conversation-title", async () => {
          await convex.mutation(api.system.updateConversationTitle, {
            internalKey,
            conversationId,
            title,
          });
        });
      }
    }
  }
);
