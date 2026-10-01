"use client";

import { useId } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Button } from "./Button";
import { useDialog } from "@/lib/useDialog";
import { useT } from "./LocaleProvider";

interface ConfirmDialogProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Defaults to the translated "Delete". */
  confirmLabel?: string;
}

export function ConfirmDialog({ title, description, onConfirm, onCancel, confirmLabel }: ConfirmDialogProps) {
  const t = useT();
  const titleId = useId();
  const dialogRef = useDialog<HTMLDivElement>(onCancel);

  // Portalled to <body>: callers such as TodoChecklist render this inside a card that has a hover
  // transform, and a transformed ancestor would otherwise become the containing block for `fixed`.
  // Only ever mounted after a user action, so `document` always exists here.
  return createPortal(
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
        className="w-full max-w-sm rounded-lg border border-primary-container/15 bg-surface-container p-6"
      >
        <h2 id={titleId} className="text-balance font-display text-lg font-semibold text-on-surface">{title}</h2>
        <p className="mt-2 font-body text-sm text-text-muted">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel ?? t("common.delete")}
          </Button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
