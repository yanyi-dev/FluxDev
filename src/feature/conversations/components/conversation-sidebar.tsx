"use client";

import ky from "ky";
import { toast } from "sonner";
import { useState } from "react";
import { CopyIcon, HistoryIcon, LoaderIcon, PlusIcon } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";

import {
  useConversation,
  useConversations,
  useCreateConversation,
  useMessages,
} from "../hooks/use-conversations";

import { Id } from "../../../../convex/_generated/dataModel";
import { DEFAULT_CONVERSATION_TITLE } from "../../../../convex/constants";

interface ConversationSidebarProps {
  projectId: Id<"projects">;
}

const ConversationSidebar = ({ projectId }: ConversationSidebarProps) => {
  const [input, setInput] = useState("");
  const [selectedConversationId, setSelectedConversationId] =
    useState<Id<"conversations"> | null>(null);

  const createConversation = useCreateConversation();
  const conversations = useConversations(projectId);

  const activeConversationId =
    selectedConversationId ?? conversations?.[0]?._id ?? null;

  const activeConversation = useConversation(activeConversationId);
  const conversationMessages = useMessages(activeConversationId);

  const isProcessing = conversationMessages?.some(
    (message) => message.status === "processing",
  );

  const hanldeCreateConversation = async () => {
    try {
      const newConversationId = await createConversation({
        projectId,
        title: DEFAULT_CONVERSATION_TITLE,
      });
      setSelectedConversationId(newConversationId);
      return newConversationId;
    } catch {
      toast.error("Failed to create conversation");
      return null;
    }
  };

  const hanldeSubmit = async (message: PromptInputMessage) => {
    if (isProcessing && !message.text) {
      setInput("");
      return;
    }

    //Todo: 输入为空的时候看有没有必要也直接返回

    let conversationId = activeConversationId;
    if (!conversationId) {
      conversationId = await hanldeCreateConversation();
      if (!conversationId) return;
    }

    try {
      await ky.post("/api/messages", {
        json: {
          conversationId,
          message: message.text,
        },
      });
    } catch {
      toast.error("Message failed to send");
    }

    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="h-8.75 flex items-center justify-between border-b">
        <div className="text-sm truncate pl-3">
          {activeConversation?.title ?? DEFAULT_CONVERSATION_TITLE}
        </div>
        <div className="flex items-center px-1 gap-1">
          <Button size="icon-xss" variant="highlight">
            <HistoryIcon className="size-3.5" />
          </Button>
          <Button
            size="icon-xss"
            variant="highlight"
            onClick={hanldeCreateConversation}
          >
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
      </div>
      <Conversation className="flex-1">
        <ConversationContent>
          {conversationMessages?.map((message, messageIndex) => (
            <Message key={message._id} from={message.role}>
              <MessageContent>
                {message.status === "processing" ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <LoaderIcon className="size-4 animate-spin" />{" "}
                    <span>Thinking...</span>
                  </div>
                ) : (
                  <MessageResponse>{message.content}</MessageResponse>
                )}
              </MessageContent>
              {message.role === "assistant" &&
                message.status === "completed" && (
                  <MessageActions className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <MessageAction
                      onClick={() =>
                        navigator.clipboard.writeText(message.content)
                      }
                      label="Copy"
                    >
                      <CopyIcon className="size-3" />
                    </MessageAction>
                  </MessageActions>
                )}
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="p-3">
        <PromptInput onSubmit={hanldeSubmit} className="mt-2.5">
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Ask FluxDev anything..."
              onChange={(e) => {
                setInput(e.target.value);
              }}
              value={input}
              disabled={isProcessing}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit
              disabled={isProcessing ? false : !input}
              // status为streaming的时候显示终止按钮
              status={isProcessing ? "streaming" : undefined}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};

export default ConversationSidebar;
