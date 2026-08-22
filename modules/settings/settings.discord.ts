import { AppError } from "@/modules/shared/errors";

/**
 * Posts a plain-text message to a Discord webhook. Runs client-side - Discord
 * webhooks accept cross-origin POSTs, so the Settings page's "Send test
 * message" button can call this directly with no backend involved.
 *
 * The scheduled daily digest (supabase/functions/daily-digest/) needs the same
 * request but runs in a separately-deployed Deno function that can't import
 * this Next.js module, so it has its own ~5-line inline copy rather than a
 * shared package - not worth the build complexity at this project's scale.
 */
export async function postDiscordMessage(webhookUrl: string, content: string): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new AppError("discord_failed", `Discord rejected the message (status ${response.status}).`);
  }
}
