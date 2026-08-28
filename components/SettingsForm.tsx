"use client";

import { useState, type FormEvent } from "react";
import { Button } from "./Button";
import { createClient } from "@/lib/supabase/client";
import { authInterface } from "@/modules/auth/auth.interface";
import { settingsInterface, type UserSettingsDTO } from "@/modules/settings/settings.interface";

interface SettingsFormProps {
  initialSettings: UserSettingsDTO | null;
}

const inputClass =
  "w-full rounded border border-transparent bg-surface-container-lowest px-3 py-2 font-body text-base text-on-surface placeholder:text-text-muted focus:border-primary focus:outline-none";

/** Personal Discord webhook + daily digest preference (docs/UI_SPEC.md "Settings"). */
export function SettingsForm({ initialSettings }: SettingsFormProps) {
  // Tracked in state (not read straight from the prop each render) so the
  // placeholder reflects a webhook just saved this session too, not only
  // what the page originally loaded with.
  const [savedWebhookUrl, setSavedWebhookUrl] = useState(initialSettings?.discord_webhook_url ?? null);

  // Starts empty even when a webhook is already saved - the saved URL is
  // surfaced via the placeholder instead (see below), not pre-filled as an
  // editable value, so it isn't sitting in plain text for anyone who opens
  // this page. Left blank on save, the existing value is kept as-is (see
  // handleSave) - it's not the same as clearing it.
  const [webhookInput, setWebhookInput] = useState("");
  const [digestEnabled, setDigestEnabled] = useState(initialSettings?.digest_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const trimmedInput = webhookInput.trim();
  const effectiveWebhookUrl = trimmedInput || savedWebhookUrl;

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
        discord_webhook_url: effectiveWebhookUrl,
        digest_enabled: digestEnabled,
      });
      setSavedWebhookUrl(effectiveWebhookUrl);
      setWebhookInput("");
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveWebhook() {
    setError(null);
    setMessage(null);
    setSaving(true);

    try {
      const supabase = createClient();
      const user = await authInterface.getCurrentUser(supabase);
      if (!user) return;

      await settingsInterface.saveSettings(supabase, user.id, {
        discord_webhook_url: null,
        digest_enabled: digestEnabled,
      });
      setSavedWebhookUrl(null);
      setWebhookInput("");
      setMessage("Webhook removed.");
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
      await settingsInterface.sendTestMessage(effectiveWebhookUrl);
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
          value={webhookInput}
          onChange={(event) => setWebhookInput(event.target.value)}
          placeholder={savedWebhookUrl ?? "https://discord.com/api/webhooks/..."}
          className={inputClass}
        />
        {savedWebhookUrl && !trimmedInput && (
          <button
            type="button"
            onClick={handleRemoveWebhook}
            disabled={saving}
            className="self-start font-body text-xs text-text-muted underline underline-offset-2 transition-colors hover:text-error disabled:pointer-events-none disabled:opacity-50"
          >
            Remove webhook
          </button>
        )}
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
          disabled={!effectiveWebhookUrl || testing}
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
