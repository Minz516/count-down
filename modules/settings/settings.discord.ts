import { AppError, ValidationError } from "@/modules/shared/errors";

const WEBHOOK_URL_PATTERN = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//;

/** The field is optional - only validate the shape when one is actually set.
 * Shared by both `settings.service.ts` (personal) and the group settings
 * service, so the two never validate against diverging patterns. */
export function assertValidWebhook(url: string | null): void {
  if (!url) return;
  if (!WEBHOOK_URL_PATTERN.test(url)) {
    throw new ValidationError("That doesn't look like a Discord webhook URL.");
  }
}

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
