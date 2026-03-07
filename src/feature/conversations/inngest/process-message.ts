import { createAgent, createNetwork, openai } from "@inngest/agent-kit";

import { inngest } from "@/inngest/client";
import { Id } from "../../../../convex/_generated/dataModel";
import { NonRetriableError } from "inngest";
import { convex } from "@/lib/convex-client";
import { api } from "../../../../convex/_generated/api";
import { CODING_AGENT_SYSTEM_PROMPT } from "./constants";
import { DEFAULT_CONVERSATION_TITLE } from "../constants";
import { createReadFilesTool } from "./tools/read-files";
import { createListFilesTool } from "./tools/list-files";
import { createUpdateFileTool } from "./tools/update-file";
import { createCreateFilesTool } from "./tools/create-files";
import { createCreateFolderTool } from "./tools/create-folder";
import { createRenameFileTool } from "./tools/rename-file";
import { createDeleteFilesTool } from "./tools/delete-files";
import { createScrapeUrlsTool } from "./tools/scrape-urls";

interface MessageEvent {
  messageId: Id<"messages">;
  conversationId: Id<"conversations">;
  projectId: Id<"projects">;
  message: string;
}

export const processMessage = inngest.createFunction(
  {
    id: "process-message",
    cancelOn: [
      {
        event: "message/cancel",
        if: "event.data.messageId == async.data.messageId",
      },
    ],
    onFailure: async ({ event, step }) => {
      const { messageId } = event.data.event.data as MessageEvent;
      const internalKey = process.env.FLUXDEV_CONVEX_INTERNAL_KEY;

      // 更新信息为失败状态
      if (internalKey) {
        await step.run("update-message-on-failure", async () => {
          await convex.mutation(api.system.updateMessageContent, {
            internalKey,
            messageId,
            content:
              "My apologies, I encountered an error while processing your request. Let me know if you need anything else!",
          });
        });
      }
    },
  },
  {
    event: "message/sent",
  },
  async ({ event, step }) => {
    const { messageId, conversationId, projectId, message } =
      event.data as MessageEvent;

    const internalKey = process.env.FLUXDEV_CONVEX_INTERNAL_KEY;

    if (!internalKey) {
      throw new NonRetriableError(
        "FLUXDEV_CONVEX_INTERNAL_KEY is not configured",
      );
    }

    // 获取具体对话
    const conversation = await step.run("get-conversation", async () => {
      return await convex.query(api.system.getConversationById, {
        internalKey,
        conversationId,
      });
    });

    if (!conversation) return new NonRetriableError("Conversation not found");

    // 获取对话上下文
    const recentMessages = await step.run("get-recent-messages", async () => {
      return await convex.query(api.system.getRecentMessages, {
        internalKey,
        conversationId,
        limit: 16,
      });
    });

    // 构建系统提示词 + 对话上下文的输入
    let systemPrompt = CODING_AGENT_SYSTEM_PROMPT;

    // 过滤ai占位回复以及空对话内容
    const contextMessages = recentMessages.filter(
      (msg) => msg._id !== messageId && msg.content.trim() !== "",
    );

    if (contextMessages.length > 0) {
      const historyText = contextMessages
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n\n");

      systemPrompt += `\n\n## Previous Conversation (for context only - do NOT repeat these responses):\n${historyText}\n\n## Current Request:\nRespond to the user's new message. You may reference the context if necessary, but avoid repeating previous long explanations or code blocks verbatim unless specifically requested.`;
    }

    // 判断是否需要生成标题
    const shouldGenerateTitle =
      conversation.title === DEFAULT_CONVERSATION_TITLE;

    if (shouldGenerateTitle) {
      await step.sendEvent("trigger-title-generation", {
        name: "conversation/generate-title",
        data: {
          conversationId,
          message,
        },
      });
    }

    // 创建编码agent助手(普通对话也通过这里回复)
    // Todo: 如果结合再一起，则需要改进提示词，或者分开行动
    const codingAgent = createAgent({
      name: "fluxdev",
      description: "An expert AI coding assistant",
      system: systemPrompt,
      model: openai({
        baseUrl: process.env.AGENT_BASE_URL,
        model:
          process.env.AGENT_CODING_MODEL ??
          "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
        apiKey: process.env.AGENT_API_KEY,
      }),
      tools: [
        createListFilesTool({ internalKey, projectId }),
        createReadFilesTool({ internalKey }),
        createUpdateFileTool({ internalKey }),
        createCreateFilesTool({ internalKey, projectId }),
        createCreateFolderTool({ internalKey, projectId }),
        createRenameFileTool({ internalKey }),
        createDeleteFilesTool({ internalKey }),
        createScrapeUrlsTool(),
      ],
    });

    // 创建网络，一般由多个agent组成，可创建强大的AI工作流程
    // 网络里面包含历史状态信息，可用于agent共享
    // 此处网络只有一个agent，未来可扩建
    const network = createNetwork({
      name: "fluxdev-network",
      agents: [codingAgent],
      maxIter: 25,
      router: ({ network }) => {
        const lastResult = network.state.results.at(-1);
        const hasTextResponse = lastResult?.output.some(
          (m) => m.type === "text" && m.role === "assistant",
        );
        const hasToolCalls = lastResult?.output.some(
          (m) => m.type === "tool_call",
        );

        if (hasTextResponse && !hasToolCalls) return undefined;

        return codingAgent;
      },
    });

    const result = await network.run(message);
    const lastResult = result.state.results.at(-1);
    const textMessage = lastResult?.output.find(
      (m) => m.type === "text" && m.role === "assistant",
    );

    let assistantResponse =
      "I processed your request. Let me know if you need anything else";

    if (textMessage?.type === "text") {
      assistantResponse =
        typeof textMessage.content === "string"
          ? textMessage.content.trim()
          : textMessage.content
              .map((c) => c.text)
              .join("")
              .trim();
    }

    // 更新ai占位回复内容
    await step.run("update-assistant-message", async () => {
      await convex.mutation(api.system.updateMessageContent, {
        internalKey,
        messageId,
        content: assistantResponse,
      });
    });

    return { success: true, messageId, conversationId };
  },
);
