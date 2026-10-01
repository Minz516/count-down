"use client";

import { useState, type FormEvent } from "react";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { maskWebhookUrl } from "@/lib/webhook";
import { createClient } from "@/lib/supabase/client";
import { authInterface } from "@/modules/auth/auth.interface";
import { settingsInterface, type UserSettingsDTO } from "@/modules/settings/settings.interface";
import { useT } from "./LocaleProvider";

interface SettingsFormProps {
  initialSettings: UserSettingsDTO | null;
}

const inputClass =
  "w-full rounded border border-transparent bg-surface-container-lowest px-3 py-2 font-body text-base text-on-surface placeholder:text-text-muted focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary/50";

/** Personal Discord webhook + daily digest preference (docs/UI_SPEC.md "Settings"). */
export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const t = useT();
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
  const [confirmingRemove, setConfirmingRemove] = useState(false);

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
      setMessage(t("settings.saved"));
    } catch (err) {
      setError(err instanceof Error ? t.text(err.message) : t("error.generic"));
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
      setMessage(t("settings.removed"));
    } catch (err) {
      setError(err instanceof Error ? t.text(err.message) : t("error.generic"));
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
      setMessage(t("settings.testSent"));
    } catch (err) {
      setError(err instanceof Error ? t.text(err.message) : t("error.sendTest"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 rounded-lg border border-primary-container/15 bg-surface-container p-6">
      <div>
        <h2 className="text-balance font-display text-xl font-semibold text-on-surface">{t("settings.digest")}</h2>
        <p className="mt-1 font-body text-sm text-text-muted">
          {t("settings.digestBody")}
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
          {t("settings.webhookUrl")}
        </span>
        <input
          type="url"
          value={webhookInput}
          onChange={(event) => setWebhookInput(event.target.value)}
          placeholder={savedWebhookUrl ? maskWebhookUrl(savedWebhookUrl) : "https://discord.com/api/webhooks/…"}
          name="discord_webhook_url"
          autoComplete="off"
          spellCheck={false}
          inputMode="url"
          className={inputClass}
        />
        {savedWebhookUrl && !trimmedInput && (
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            disabled={saving}
            className="-my-1 inline-flex min-h-11 items-center self-start font-body text-xs sm:min-h-8 sm:text-xs text-text-muted underline underline-offset-2 transition-colors hover:text-error disabled:pointer-events-none disabled:opacity-50"
          >
            {t("settings.removeWebhook")}
          </button>
        )}
      </label>

      <label className="flex items-center gap-2 font-body text-sm text-on-surface">
        <input
          type="checkbox"
          name="digest_enabled"
          checked={digestEnabled}
          onChange={(event) => setDigestEnabled(event.target.checked)}
          className="size-4 rounded border-outline-variant bg-surface-container-lowest accent-primary-container"
        />
        {t("settings.enableDigest")}
      </label>

      {error && <p role="alert" className="font-body text-sm text-error">{error}</p>}
      {message && <p role="status" className="font-body text-sm text-primary">{message}</p>}

      <div className="flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={!effectiveWebhookUrl || testing}
          onClick={handleTestMessage}
        >
          {testing ? t("common.sending") : t("settings.sendTest")}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t("common.saving") : t("settings.save")}
        </Button>
      </div>

      {confirmingRemove && (
        <ConfirmDialog
          title={t("settings.removeTitle")}
          description={t("settings.removeBody")}
          confirmLabel={t("common.remove")}
          onConfirm={() => {
            setConfirmingRemove(false);
            void handleRemoveWebhook();
          }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </form>
  );
}
