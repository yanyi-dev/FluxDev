import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { z } from "zod";
import { deepseek } from "@/lib/ai";
import { generateText, Output } from "ai";

const editRequestSchema = z.object({
  fileName: z.string(),
  selectedCode: z.string(),
  fullCode: z.string(),
  instruction: z.string(),
});

const quickEditSchema = z.object({
  editedCode: z
    .string()
    .describe(
      "The edited version od the selected code based on the instruction",
    ),
});

const URL_REGEX = /https?:\/\/[^\s)>\]]+(?<![.,!?;:])/g;

const QUICK_EDIT_PROMPT = `You are a precise code editing assistant. Your task is to modify the selected code according to the user's instruction.

<context>
<file_info>
<fileName>{fileName}</fileName>
</file_info>

<selected_code>
{selectedCode}
</selected_code>

<surrounding_context>
{fullCode}
</surrounding_context>

{documentation}
</context>

<user_request>
{instruction}
</user_request>

<rules>
1. Return ONLY the edited code that should replace the selected code.
2. Do NOT wrap the output in markdown code blocks.
3. Preserve the original indentation and formatting style.
4. If the request is ambiguous, make the most reasonable interpretation.
5. If the request cannot be applied to the selected code, return it unchanged.
6. Do not add explanatory comments unless explicitly requested.
</rules>
7. You MUST output ONLY a valid JSON object: {"editedCode": "<your edited code>"}. No other text is allowed
`;
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.text();
    if (!body || body.trim().length === 0) {
      return NextResponse.json(
        { error: "Empty request body" },
        { status: 400 },
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parseResult = editRequestSchema.safeParse(json);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { selectedCode, fullCode, instruction, fileName } = parseResult.data;

    const urls: string[] = instruction.match(URL_REGEX) || [];

    let documentationContext = "";
    if (urls.length > 0) {
      const scrapedContent = await Promise.all(
        urls.map(async (url) => {
          try {
            const controller = new AbortController();
            // 超时取消网页爬取
            const timeout = setTimeout(() => controller.abort(), 8000);

            const result = await fetch(`https://r.jina.ai/${url}`, {
              signal: controller.signal,
              method: "GET",
              headers: {
                ...(process.env.JINA_API_KEY && {
                  Authorization: `Bearer ${process.env.JINA_API_KEY}`,
                }),
                "X-Return-Format": "markdown",
              },
            });

            clearTimeout(timeout);

            if (!result.ok) {
              throw new Error(`Jina API status: ${result.status}`);
            }

            const text = await result.text();
            return `<doc url="${url}">\n${text}\n</doc>`;
          } catch {
            return null;
          }
        }),
      );

      const validResults = scrapedContent.filter(Boolean);
      if (validResults.length > 0) {
        documentationContext = `<documentation>\n${validResults.join("\n\n")}\n</documentation>`;
      }
    }

    const prompt = QUICK_EDIT_PROMPT.replace("{fileName}", fileName)
      .replace("{selectedCode}", selectedCode)
      .replace("{fullCode}", fullCode || "")
      .replace("{instruction}", instruction)
      .replace("{documentation}", documentationContext);

    const { output } = await generateText({
      model: deepseek("deepseek-ai/DeepSeek-R1-0528-Qwen3-8B"),
      output: Output.object({ schema: quickEditSchema }),
      prompt,
      abortSignal: request.signal,
    });

    return NextResponse.json({ editedCode: output.editedCode });
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    console.error("Error in quick-edit:", error);
    return NextResponse.json(
      { error: "Failed to generate edited code" },
      { status: 500 },
    );
  }
}
