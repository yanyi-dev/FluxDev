import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { inngest } from "@/inngest/client";
import { convex } from "@/lib/convex-client";

import { api } from "../../../../convex/_generated/api";

import { Id } from "../../../../convex/_generated/dataModel";

const resquestSchema = z.object({
  conversationId: z.string(),
  message: z.string(),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 保护内部convex函数(被服务端调用的)不被恶意调用，(服务端鉴权)
  const internalKey = process.env.FLUXDEV_CONVEX_INTERNAL_KEY;

  if (!internalKey) {
    return NextResponse.json(
      { error: "Internal key not configured" },
      { status: 500 },
    );
  }

  const body = await request.json();
  const parsed = resquestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { conversationId, message } = parsed.data;

  // 在服务端调用convex，获取对话信息
  const conversation = await convex.query(api.system.getConversationById, {
    internalKey,
    conversationId: conversationId as Id<"conversations">,
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  const projectId = conversation.projectId;

  //Todo: 检查是否已经有正在进行的对话，有就停止发送

  // 保存用户对话
  await convex.mutation(api.system.createMessage, {
    internalKey,
    conversationsId: conversationId as Id<"conversations">,
    projectId: projectId,
    role: "user",
    content: message,
  });

  // 创建ai回复占位数据
  const assistantMessageId = await convex.mutation(api.system.createMessage, {
    internalKey,
    conversationsId: conversationId as Id<"conversations">,
    projectId: projectId,
    role: "assistant",
    content: "",
    status: "processing",
  });

  // Todo: 调用inngest去处理message
  const event = await inngest.send({
    name: "message/sent",
    data: {
      messageId: assistantMessageId,
      conversationId: conversationId as Id<"conversations">,
      projectId: projectId,
      message: message,
    },
  });

  return NextResponse.json({
    success: true,
    eventId: event.ids[0], // Todo: 使用inngest的event id
    messageId: assistantMessageId,
  });
}
