import { AppError } from "@/modules/shared/errors";
import type { ToolContext } from "../registry";

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export const textResult = (text: string): ToolResult => ({ content: [{ type: "text", text }] });

/**
 * Runs a tool body and turns every failure into a tool error Claude can read. Expected problems (bad input,
 * bad token, rate limits) are AppErrors with safe, fixed messages. Anything else is reported for monitoring
 * and replaced by a generic message, because an unknown error could carry text we must not show.
 */
export async function runTool(context: ToolContext, body: () => Promise<string>): Promise<ToolResult> {
  try {
    return textResult(await body());
  } catch (error) {
    if (error instanceof AppError) return { ...textResult(error.message), isError: true };
    context.onUnexpectedError?.(error);
    return { ...textResult("Something went wrong while handling the request"), isError: true };
  }
}
