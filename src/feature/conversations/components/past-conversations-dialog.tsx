"use client";

import { formatDistanceToNow } from "date-fns";
import { TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import {
  useConversations,
  useRemoveConversation,
} from "../hooks/use-conversations";

import { Id } from "../../../../convex/_generated/dataModel";

interface PastConversationsDialogProps {
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (conversationId: Id<"conversations">) => void;
}

export const PastConversationsDialog = ({
  projectId,
  open,
  onOpenChange,
  onSelect,
}: PastConversationsDialogProps) => {
  const conversations = useConversations(projectId);
  const removeConversation = useRemoveConversation();

  const handleSelect = (conversationId: Id<"conversations">) => {
    onSelect(conversationId);
    // 关闭选择弹窗
    onOpenChange(false);
  };

  const handleRemove = async (
    e: React.MouseEvent,
    conversationId: Id<"conversations">,
  ) => {
    e.stopPropagation();
    try {
      await removeConversation({ id: conversationId });
      toast.success("Conversation deleted");
    } catch {
      toast.error("Failed to delete conversation");
    }
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Past Conversations"
      description="Search and select a past conversation"
    >
      <CommandInput placeholder="Search conversations..." />
      <CommandList>
        <CommandEmpty>No conversations found.</CommandEmpty>
        <CommandGroup heading="Past Conversations">
          {conversations?.map((conversation) => (
            <CommandItem
              key={conversation._id}
              // 确保value唯一，防止重名
              value={`${conversation.title}-${conversation._id}`}
              onSelect={() => handleSelect(conversation._id)}
              className="group flex justify-between items-center"
            >
              <div className="flex flex-col gap-0.5">
                <span>{conversation.title}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(conversation._creationTime, {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-xss"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleRemove(e, conversation._id)}
              >
                <TrashIcon className="size-3.5 text-muted-foreground hover:text-destructive " />
              </Button>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
