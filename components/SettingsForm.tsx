"use client";

import { useState, type FormEvent } from "react";
import { Button } from "./Button";
import { createClient } from "@/lib/supabase/client";
import { authInterface } from "@/modules/auth/auth.interface";
import { settingsInterface } from "@/modules/settings/settings.interface";
import type { UserSettings } from "@/types/settings";

interface SettingsFormProps {
  initialSettings: UserSettings | null;
}

const inputClass =
  "w-full rounded border border-transparent bg-surface-container-lowest px-3 py-2 font-body text-base text-on-surface placeholder:text-text-muted focus:border-primary focus:outline-none";

/** Personal Discord webhook + daily digest preference (docs/UI_SPEC.md "Settings"). */
export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [webhookUrl, setWebhookUrl] = useState(initialSettings?.discord_webhook_url ?? "");
  const [digestEnabled, setDigestEnabled] = useState(initialSettings?.digest_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);

    try {
      const supabase = createClient();
      const user = await authInterface.getCurrentUser(supabase);
      if (!user) return;

      await settingsInterface.saveSettings(supabase, user.id, {
        discord_webhook_url: webhookUrl.trim() || null,
        digest_enabled: digestEnabled,
      });
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestMessage() {
    setError(null);
    setMessage(null);
    setTesting(true);

    try {
      await settingsInterface.sendTestMessage(webhookUrl.trim() || null);
      setMessage("Test message sent - check your Discord channel.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the test message.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 rounded-lg border border-primary-container/15 bg-surface-container p-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-on-surface">Discord Digest</h2>
        <p className="mt-1 font-body text-sm text-text-muted">
          Get a daily message listing events due within the next 7 days.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
          Discord Webhook URL
        </span>
        <input
          type="url"
          value={webhookUrl}
          onChange={(event) => setWebhookUrl(event.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className={inputClass}
        />
      </label>

      <label className="flex items-center gap-2 font-body text-sm text-on-surface">
        <input
          type="checkbox"
          checked={digestEnabled}
          onChange={(event) => setDigestEnabled(event.target.checked)}
          className="size-4 rounded border-outline-variant bg-surface-container-lowest accent-primary-container"
        />
        Enable daily digest
      </label>

      {error && <p className="font-body text-sm text-error">{error}</p>}
      {message && <p className="font-body text-sm text-primary">{message}</p>}

      <div className="flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={!webhookUrl.trim() || testing}
          onClick={handleTestMessage}
        >
          {testing ? "Sending..." : "Send test message"}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
