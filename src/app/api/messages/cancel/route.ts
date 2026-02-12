import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { inngest } from "@/inngest/client";
import { convex } from "@/lib/convex-client";

import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

const resquestSchema = z.object({
  projectId: z.string(),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const internalKey = process.env.FLUXDEV_CONVEX_INTERNAL_KEY;

  if (!internalKey)
    return NextResponse.json(
      { error: "Internal key not configured" },
      { status: 500 },
    );

  const body = await request.json();
  const parsed = resquestSchema.safeParse(body);

  if (!parsed.success)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { projectId } = parsed.data;

  // 找到所有正在进行的对话进行删除
  // 但实际上目前设计中，一个项目只会有一个对话
  // Todo: 后续需要支持多对话，这里得改成精确删除
  const processingMessages = await convex.query(
    api.system.getProcessingMessages,
    {
      internalKey,
      projectId: projectId as Id<"projects">,
    },
  );

  if (processingMessages.length === 0) {
    return NextResponse.json({ success: true, cancelled: false });
  }

  const cancelledIds = await Promise.all(
    processingMessages.map(async (msg) => {
      await inngest.send({
        name: "message/cancel",
        data: {
          messageId: msg._id,
        },
      });

      await convex.mutation(api.system.updateMessageStatus, {
        internalKey,
        messageId: msg._id,
        status: "cancelled",
      });

      return msg._id;
    }),
  );

  return NextResponse.json({
    success: true,
    cancelled: true,
    messageIds: cancelledIds,
  });
}
