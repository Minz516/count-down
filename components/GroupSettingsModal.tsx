"use client";

import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { Check, Copy, X } from "@phosphor-icons/react/ssr";
import { Button } from "./Button";
import { createClient } from "@/lib/supabase/client";
import { groupSettingsInterface } from "@/modules/groups/groups.interface";
import type { GroupRecord, GroupSettings } from "@/types/group";

interface GroupSettingsModalProps {
  group: GroupRecord;
  initialSettings: GroupSettings | null;
  onClose: () => void;
}

const inputClass =
  "w-full rounded border border-transparent bg-surface-container-lowest px-3 py-2 font-body text-base text-on-surface placeholder:text-text-muted focus:border-primary focus:outline-none";

/**
 * Invite code + member count + the group's own Discord webhook (docs/milestone2/UI_SPEC-milestone-2.md
 * "Group Settings") - a modal rather than a separate route/tab, since the spec allows either
 * and this avoids a new page for what's a small, single-purpose panel.
 */
export function GroupSettingsModal({ group, initialSettings, onClose }: GroupSettingsModalProps) {
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(initialSettings?.discord_webhook_url ?? "");
  const [digestEnabled, setDigestEnabled] = useState(initialSettings?.digest_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCopy() {
    await navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);

    try {
      const supabase = createClient();
      await groupSettingsInterface.saveSettings(supabase, group.id, {
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
      await groupSettingsInterface.sendTestMessage(webhookUrl.trim() || null);
      setMessage("Test message sent - check the group's Discord channel.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the test message.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-deep/70 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-md rounded-lg border border-primary-container/15 bg-surface-container p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-on-surface">Group Settings</h2>
            <p className="mt-1 font-body text-sm text-text-muted">{group.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-text-muted hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex items-center justify-between rounded border border-primary-container/15 bg-surface-container-lowest px-3 py-2">
            <div>
              <p className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
                Invite code
              </p>
              <p className="font-mono text-lg tracking-[0.15em] text-on-surface">{group.invite_code}</p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy invite code"
              className="rounded p-2 text-text-muted transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
            >
              {copied ? <Check size={18} className="text-primary" /> : <Copy size={18} />}
            </button>
          </div>

          <p className="font-mono text-xs tracking-[0.1em] text-text-muted uppercase">
            {group.member_count} / 10 thành viên
          </p>
        </div>

        <form onSubmit={handleSave} className="mt-6 flex flex-col gap-4 border-t border-primary-container/10 pt-6">
          <div>
            <h3 className="font-display text-base font-semibold text-on-surface">Discord Digest</h3>
            <p className="mt-1 font-body text-sm text-text-muted">
              Get a daily message listing this group&apos;s events due within the next 7 days.
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
              Discord Webhook URL
            </span>
            <input
              type="url"
              value={webhookUrl}
              onChange={(inputEvent) => setWebhookUrl(inputEvent.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className={inputClass}
            />
          </label>

          <label className="flex items-center gap-2 font-body text-sm text-on-surface">
            <input
              type="checkbox"
              checked={digestEnabled}
              onChange={(inputEvent) => setDigestEnabled(inputEvent.target.checked)}
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
      </motion.div>
    </div>
  );
}
