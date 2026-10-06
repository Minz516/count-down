"use client";

import { useId, useState, type FormEvent } from "react";
import { Check, Copy, X } from "@phosphor-icons/react/ssr";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { useDialog } from "@/lib/useDialog";
import { apiTokensInterface, type CreatedApiTokenDTO } from "@/modules/apitokens/apitokens.interface";
import { Button } from "./Button";
import { DateField } from "./DateField";
import { useT } from "./LocaleProvider";

interface ApiTokenCreateDialogProps {
  /** Called after a token exists, so the list behind the dialog can refresh. The token itself is never passed on. */
  onCreated: () => void;
  onClose: () => void;
}

const inputClass =
  "w-full rounded border border-field-border bg-surface-container-lowest px-3 py-2 font-body text-base text-on-surface placeholder:text-text-muted focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary/50";

/**
 * Two steps in one dialog: a form, then the one-time reveal of the plain token. The token lives only in this
 * component's state, so closing the dialog (which unmounts it) discards it: nothing is stored in Redux,
 * localStorage or the URL, and the list in the page behind it only ever shows the short prefix.
 */
export function ApiTokenCreateDialog({ onCreated, onClose }: ApiTokenCreateDialogProps) {
  const t = useT();
  const titleId = useId();
  const dialogRef = useDialog<HTMLDivElement>(onClose);

  const [name, setName] = useState("");
  const [expiryDate, setExpiryDate] = useState(""); // yyyy-mm-dd or ""
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiTokenDTO | null>(null);
  const [copied, setCopied] = useState<"token" | "command" | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // The chosen day counts until its last second, in the viewer's own time zone.
      const expiresAt = expiryDate ? new Date(`${expiryDate}T23:59:59`).toISOString() : null;
      const result = await apiTokensInterface.createToken(createClient(), { name, expiresAt });
      setCreated(result);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? t.text(err.message) : t("error.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(kind: "token" | "command", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied((current) => (current === kind ? null : current)), 2000);
    } catch {
      // Clipboard access can be refused; the text is still on screen to select by hand.
    }
  }

  // Built when the token exists, in the browser, so it names the site the owner is actually using.
  const command = created
    ? `claude mcp add --transport http --scope user countdown ${window.location.origin}/api/mcp --header "Authorization: Bearer ${created.token}"`
    : "";

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
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-primary-container/15 bg-surface-container p-6"
      >
        <div className="flex items-start justify-between">
          <h2 id={titleId} className="text-balance font-display text-xl font-semibold text-on-surface">
            {created ? t("tokens.shown.title") : t("tokens.dialog.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded p-3 text-text-muted hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2 sm:p-1"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        {created ? (
          <div className="mt-4 flex flex-col gap-4">
            <p role="status" className="font-body text-sm text-accent-warning">
              {t("tokens.shown.warning")}
            </p>

            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
                {t("tokens.shown.tokenLabel")}
              </span>
              <code
                translate="no"
                className="block rounded bg-surface-container-lowest px-3 py-2 font-mono text-sm break-all text-on-surface select-all"
              >
                {created.token}
              </code>
              <Button type="button" variant="ghost" onClick={() => copy("token", created.token)} className="self-start">
                {copied === "token" ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
                {copied === "token" ? t("tokens.shown.copied") : t("tokens.shown.copy")}
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-body text-sm text-text-muted">{t("tokens.shown.commandLabel")}</span>
              <code
                translate="no"
                className="block rounded bg-surface-container-lowest px-3 py-2 font-mono text-xs break-all text-on-surface-variant select-all"
              >
                {command}
              </code>
              <Button type="button" variant="ghost" onClick={() => copy("command", command)} className="self-start">
                {copied === "command" ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
                {copied === "command" ? t("tokens.shown.copied") : t("tokens.shown.copyCommand")}
              </Button>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={onClose}>
                {t("tokens.shown.done")}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
                {t("tokens.dialog.nameLabel")}
              </span>
              <input
                type="text"
                name="token_name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("tokens.dialog.namePlaceholder")}
                autoComplete="off"
                data-autofocus
                maxLength={60}
                required
                className={inputClass}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
                {t("tokens.dialog.expiryLabel")}
              </span>
              <DateField value={expiryDate} onChange={setExpiryDate} />
            </div>

            {error && (
              <p role="alert" className="font-body text-sm text-error">
                {error}
              </p>
            )}

            <div className="mt-2 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? t("common.saving") : t("tokens.dialog.submit")}
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
