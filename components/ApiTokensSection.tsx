"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { apiTokensInterface, type ApiTokenDTO, type ApiTokenStatus } from "@/modules/apitokens/apitokens.interface";
import { ApiTokenCreateDialog } from "./ApiTokenCreateDialog";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { LocalDate } from "./LocalDate";
import { useT } from "./LocaleProvider";

interface ApiTokensSectionProps {
  userId: string;
  initialTokens: ApiTokenDTO[];
  /** True when the server could not read the tokens (for example the migration has not been run yet). */
  loadFailed?: boolean;
}

const STATUS_CLASSES: Record<ApiTokenStatus, string> = {
  active: "bg-primary/12 text-primary",
  expired: "bg-status-soon/12 text-status-soon",
  revoked: "bg-text-muted/12 text-text-muted",
};

/**
 * Settings section "Claude Code access": the owner's personal access tokens. The list shows only names,
 * the short prefix and dates, never a token value. A new token is revealed once, inside the create dialog.
 */
export function ApiTokensSection({ userId, initialTokens, loadFailed = false }: ApiTokensSectionProps) {
  const t = useT();
  const [tokens, setTokens] = useState(initialTokens);
  const [createOpen, setCreateOpen] = useState(false);
  const [revoking, setRevoking] = useState<ApiTokenDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setTokens(await apiTokensInterface.listTokens(createClient(), userId));
    } catch (err) {
      setError(err instanceof Error ? t.text(err.message) : t("error.generic"));
    }
  }

  async function handleRevoke(token: ApiTokenDTO) {
    setRevoking(null);
    setError(null);
    try {
      await apiTokensInterface.revokeToken(createClient(), token.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? t.text(err.message) : t("error.generic"));
    }
  }

  return (
    <section
      aria-labelledby="api-tokens-title"
      className="flex flex-col gap-4 rounded-lg border border-primary-container/15 bg-surface-container p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="api-tokens-title" className="text-balance font-display text-xl font-semibold text-on-surface">
          {t("tokens.title")}
        </h2>
        <p className="font-body text-sm text-text-muted">{t("tokens.description")}</p>
      </div>

      {loadFailed && (
        <p role="alert" className="font-body text-sm text-error">
          {t("tokens.loadFailed")}
        </p>
      )}

      {tokens.length === 0 && !loadFailed ? (
        <p className="font-body text-sm text-text-muted">{t("tokens.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tokens.map((token) => (
            <li
              key={token.id}
              className="flex flex-col gap-3 rounded-lg border border-primary-container/10 bg-surface-container-lowest p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-body text-base font-semibold text-on-surface">{token.name}</span>
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 font-mono text-xs tracking-[0.1em] whitespace-nowrap uppercase",
                      STATUS_CLASSES[token.status],
                    )}
                  >
                    {t(`tokens.status.${token.status}`)}
                  </span>
                </div>
                <p translate="no" className="font-mono text-xs text-text-muted">
                  {token.prefix}…
                </p>
                <p className="font-body text-xs text-text-muted">
                  {t("tokens.created")} <LocalDate iso={token.createdAt} kind="date" />
                  {" · "}
                  {token.lastUsedAt ? (
                    <>
                      {t("tokens.lastUsed")} <LocalDate iso={token.lastUsedAt} kind="date" />
                    </>
                  ) : (
                    t("tokens.neverUsed")
                  )}
                  {" · "}
                  {token.expiresAt ? (
                    <>
                      {t("tokens.expires")} <LocalDate iso={token.expiresAt} kind="date" />
                    </>
                  ) : (
                    t("tokens.noExpiry")
                  )}
                </p>
              </div>

              {token.status === "active" && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setRevoking(token)}
                  aria-label={t("tokens.revokeAria", { name: token.name })}
                  className="self-start sm:self-center"
                >
                  {t("tokens.revoke")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="font-body text-sm text-error">
          {error}
        </p>
      )}

      <div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          {t("tokens.create")}
        </Button>
      </div>

      <AnimatePresence>
        {createOpen && <ApiTokenCreateDialog key="create" onCreated={refresh} onClose={() => setCreateOpen(false)} />}
        {revoking && (
          <ConfirmDialog
            key={`revoke-${revoking.id}`}
            title={t("tokens.revokeTitle")}
            description={t("tokens.revokeBody", { name: revoking.name })}
            confirmLabel={t("tokens.revoke")}
            onConfirm={() => handleRevoke(revoking)}
            onCancel={() => setRevoking(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
