"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, Copy, PencilSimple, X } from "@phosphor-icons/react/ssr";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { maskWebhookUrl } from "@/lib/webhook";
import { ConfirmDialog } from "./ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { groupSettingsInterface, groupsInterface } from "@/modules/groups/groups.interface";
import type { GroupDTO, GroupMemberDTO, GroupSettingsDTO } from "@/modules/groups/groups.interface";
import { focusIfFinePointer } from "@/lib/focus";
import { useDialog } from "@/lib/useDialog";
import { useT } from "./LocaleProvider";

interface GroupSettingsModalProps {
  group: GroupDTO;
  currentUserId: string;
  initialSettings: GroupSettingsDTO | null;
  initialMembers: GroupMemberDTO[];
  onClose: () => void;
}

const inputClass =
  "w-full rounded border border-field-border bg-surface-container-lowest px-3 py-2 font-body text-base text-on-surface placeholder:text-text-muted focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary/50";

/**
 * Invite code + member count + the group's own Discord webhook (docs/milestone2/UI_SPEC-milestone-2.md
 * "Group Settings") - a modal rather than a separate route/tab, since the spec allows either
 * and this avoids a new page for what's a small, single-purpose panel.
 */
export function GroupSettingsModal({
  group,
  currentUserId,
  initialSettings,
  initialMembers,
  onClose,
}: GroupSettingsModalProps) {
  const t = useT();
  const router = useRouter();
  const isCreator = group.created_by === currentUserId;

  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(group.name);
  const [renaming, setRenaming] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Tracked in state (not read straight from the prop each render) so the
  // placeholder reflects a webhook just saved this session too, not only
  // what the modal originally opened with.
  const [savedWebhookUrl, setSavedWebhookUrl] = useState(initialSettings?.discord_webhook_url ?? null);

  // Starts empty even when a webhook is already saved - the saved URL is
  // surfaced via the placeholder instead (see below), not pre-filled as an
  // editable value visible to every member who opens this modal. Left blank
  // on save, the existing value is kept as-is (see handleSave) - it's not
  // the same as clearing it.
  const [webhookInput, setWebhookInput] = useState("");
  const [digestEnabled, setDigestEnabled] = useState(initialSettings?.digest_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const trimmedInput = webhookInput.trim();
  const effectiveWebhookUrl = trimmedInput || savedWebhookUrl;

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
      await groupSettingsInterface.saveSettings(supabase, group.id, {
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

  async function handleRenameSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = nameInput.trim();
    setNameError(null);
    setRenaming(true);

    try {
      const supabase = createClient();
      await groupsInterface.renameGroup(supabase, group.id, trimmed);
      setEditingName(false);
      router.refresh();
    } catch (err) {
      setNameError(err instanceof Error ? t.text(err.message) : t("error.generic"));
    } finally {
      setRenaming(false);
    }
  }

  async function handleDeleteGroup() {
    setError(null);
    setDeleting(true);

    try {
      const supabase = createClient();
      await groupsInterface.deleteGroup(supabase, group.id);
      router.push("/groups");
    } catch (err) {
      setError(err instanceof Error ? t.text(err.message) : t("error.generic"));
      setConfirmingDelete(false);
      setDeleting(false);
    }
  }

  async function handleTestMessage() {
    setError(null);
    setMessage(null);
    setTesting(true);

    try {
      await groupSettingsInterface.sendTestMessage(effectiveWebhookUrl);
      setMessage(t("settings.testSentGroup"));
    } catch (err) {
      setError(err instanceof Error ? t.text(err.message) : t("error.sendTest"));
    } finally {
      setTesting(false);
    }
  }

  const titleId = useId();
  const dialogRef = useDialog<HTMLDivElement>(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-surface-deep/70 px-4">
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-md rounded-lg border border-primary-container/15 bg-surface-container p-6"
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-balance font-display text-xl font-semibold text-on-surface">{t("groupSettings.title")}</h2>

            {editingName ? (
              <form onSubmit={handleRenameSubmit} className="mt-1 flex items-center gap-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(inputEvent) => setNameInput(inputEvent.target.value)}
                  ref={focusIfFinePointer}
                  name="group_name"
                  aria-label={t("common.groupName")}
                  autoComplete="off"
                  className="w-full rounded border border-field-border bg-surface-container-lowest px-2 py-1 font-body text-sm text-on-surface focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary/50"
                />
                <button
                  type="submit"
                  disabled={renaming}
                  aria-label={t("groupSettings.saveName")}
                  className="rounded p-1 text-text-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  <Check aria-hidden="true" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingName(false);
                    setNameError(null);
                  }}
                  disabled={renaming}
                  aria-label={t("common.cancel")}
                  className="rounded p-1 text-text-muted hover:text-error focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </form>
            ) : (
              <div className="mt-1 flex items-center gap-1">
                <p className="truncate font-body text-sm text-text-muted">{group.name}</p>
                {isCreator && (
                  <button
                    type="button"
                    onClick={() => {
                      setNameInput(group.name);
                      setNameError(null);
                      setEditingName(true);
                    }}
                    aria-label={t("groupSettings.editName")}
                    className="rounded p-1 text-text-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
                  >
                    <PencilSimple aria-hidden="true" size={14} />
                  </button>
                )}
              </div>
            )}

            {nameError && <p role="alert" className="mt-1 font-body text-xs text-error">{nameError}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded p-1 text-text-muted hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex items-center justify-between rounded border border-primary-container/15 bg-surface-container-lowest px-3 py-2">
            <div>
              <p className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
                {t("common.inviteCode")}
              </p>
              <p translate="no" className="font-mono text-lg tracking-[0.15em] text-on-surface">{group.invite_code}</p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={t("common.copyInviteCode")}
              className="rounded p-2 text-text-muted transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
            >
              {copied ? <Check aria-hidden="true" size={18} className="text-primary" /> : <Copy aria-hidden="true" size={18} />}
            </button>
          </div>

          <div>
            <p className="font-mono text-xs tracking-[0.1em] text-text-muted uppercase">
              {t("nav.members", { n: group.member_count })}
            </p>
            <ul className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto">
              {initialMembers.map((member) => (
                <li key={member.user_id} className="flex items-center gap-2.5">
                  <Avatar src={member.avatar_url} alt="" size={24} />
                  <span className="truncate font-body text-sm text-on-surface">
                    {member.username ?? t("groupSettings.unnamed")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-6 flex flex-col gap-4 border-t border-primary-container/10 pt-6">
          <div>
            <h3 className="text-balance font-display text-base font-semibold text-on-surface">{t("settings.digest")}</h3>
            <p className="mt-1 font-body text-sm text-text-muted">
              {t("groupSettings.digestBody")}
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
              {t("settings.webhookUrl")}
            </span>
            <input
              type="url"
              value={webhookInput}
              onChange={(inputEvent) => setWebhookInput(inputEvent.target.value)}
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
                className="-my-1 inline-flex min-h-11 items-center self-start font-body text-xs sm:min-h-8 text-text-muted underline underline-offset-2 transition-colors hover:text-error disabled:pointer-events-none disabled:opacity-50"
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
              onChange={(inputEvent) => setDigestEnabled(inputEvent.target.checked)}
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
        </form>

        {isCreator && (
          <div className="mt-6 flex items-center justify-between border-t border-error/20 pt-6">
            <div>
              <h3 className="text-balance font-display text-base font-semibold text-on-surface">{t("groupSettings.dangerZone")}</h3>
              <p className="mt-1 font-body text-sm text-text-muted">
                {t("groupSettings.deleteHelp")}
              </p>
            </div>
            <Button
              type="button"
              variant="danger"
              disabled={deleting}
              onClick={() => setConfirmingDelete(true)}
            >
              {t("groupSettings.deleteGroup")}
            </Button>
          </div>
        )}
      </motion.div>

      {confirmingRemove && (
        <ConfirmDialog
          title={t("settings.removeTitle")}
          description={t("groupSettings.removeBody")}
          confirmLabel={t("common.remove")}
          onConfirm={() => {
            setConfirmingRemove(false);
            void handleRemoveWebhook();
          }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title={t("groupSettings.deleteTitle")}
          description={t("groupSettings.deleteBody", { name: group.name })}
          onConfirm={handleDeleteGroup}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
