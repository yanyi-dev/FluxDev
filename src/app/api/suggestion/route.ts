import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { z } from "zod";
import { deepseek } from "@/lib/ai";
import { generateText, Output } from "ai";

const suggestionRequestSchema = z.object({
  fileName: z.string(),
  previousLines: z.string(),
  textBeforeCursor: z.string(),
  textAfterCursor: z.string(),
  nextLines: z.string(),
});

const suggestionSchema = z.object({
  suggestion: z
    .string()
    .describe(
      "The code to insert at cursor, or empty if no completion needed.DO NOT include markdown blocks or any text other than code.",
    )
    .transform((s) => {
      // 移除 markdown 代码块包装
      const codeBlockMatch = s.match(/^```[\w]*\n?([\s\S]*?)\n?```$/);
      if (codeBlockMatch) {
        return codeBlockMatch[1];
      }
      return s;
    }),
});

const SUGGESTION_PROMPT = `You are an expert code completion AI.
Your task is to predict and generate the code that should immediately follow the <cursor_position>.

<context_structure>
The file content is split into two parts relative to the cursor:
1. <code_before_cursor>: Everything up to the cursor.
2. <code_after_cursor>: Everything after the cursor.
</context_structure>

<context>
<file_name>{fileName}</file_name>
<code_before_cursor>
{previousLines}
{beforeCursor}
</code_before_cursor>
<code_after_cursor>
{afterCursor}
{nextLines}
</code_after_cursor>
</context>

<instructions>
1. **Analyze Context**: Understand the syntax, variable scope, and intent from <code_before_cursor>.
2. **Check Completeness**: If <code_after_cursor> already provides a logical continuation, return an EMPTY string.
3. **Generate Bridge**: If there is a logical gap, suggest ONLY the minimal code needed to bridge the cursor to <code_after_cursor>.
4. **No Repetition**: NEVER repeat any code that already exists in <code_after_cursor>.
5. **Pure Code Only**: Return ONLY raw code. NO explanations, NO comments, NO markdown, NO chat.
6. **When to Return Empty**: Return an empty string "" if:
   - The code is already complete and nothing should be inserted.
   - There is no clear, obvious next step.
   - Adding code would be redundant or speculative.
</instructions>

<critical_rules>
VIOLATION OF THESE RULES WILL MAKE YOUR OUTPUT USELESS:
- DO NOT explain what you are doing.
- DO NOT repeat existing code from <code_after_cursor>.
- DO NOT wrap output in markdown code blocks.
- If uncertain, return "" (empty string) — silence is better than garbage.
</critical_rules>`;

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
    const parseResult = suggestionRequestSchema.safeParse(json);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const {
      fileName,
      previousLines,
      textBeforeCursor,
      textAfterCursor,
      nextLines,
    } = parseResult.data;

    const prompt = SUGGESTION_PROMPT.replace("{fileName}", fileName)
      .replace("{previousLines}", previousLines || "")
      .replace("{beforeCursor}", textBeforeCursor)
      .replace("{afterCursor}", textAfterCursor)
      .replace("{nextLines}", nextLines || "");

    const { output } = await generateText({
      model: deepseek("deepseek-ai/DeepSeek-R1-0528-Qwen3-8B"),
      output: Output.object({ schema: suggestionSchema }),
      prompt,
      abortSignal: request.signal,
    });

    return NextResponse.json({ suggestion: output.suggestion });
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    console.error("Error generating suggestion:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestion" },
      { status: 500 },
    );
  }
}
