/**
 * A Discord webhook URL is a secret (anyone holding it can post to the channel), so screens
 * show it masked: the fixed prefix plus the last four characters, never the whole token.
 */
export function maskWebhookUrl(url: string): string {
  const tail = url.slice(-4);
  return `https://discord.com/api/webhooks/••••••••${tail}`;
}
