"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal behaviour shared by ConfirmDialog, EventForm, EditProfileModal and GroupSettingsModal:
 * Escape closes, Tab stays inside the panel, focus moves in on open and returns to the opener on
 * close, background scroll is locked, and a reload or tab close warns once the user has typed
 * into the panel. Put the returned ref on the dialog panel (the element with role="dialog").
 */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const panelRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first field, else the panel itself. Skipped for coarse pointers so a phone's
    // on-screen keyboard doesn't pop up the moment a dialog opens.
    const first = panel.querySelector<HTMLElement>(FOCUSABLE);
    const preferField = window.matchMedia("(pointer: fine)").matches;
    (preferField && first ? first : panel).focus({ preventScroll: true });

    let dirty = false;
    const markDirty = () => {
      dirty = true;
    };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === firstEl || document.activeElement === panel)) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    panel.addEventListener("input", markDirty);
    panel.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", warnBeforeUnload);

    return () => {
      panel.removeEventListener("input", markDirty);
      panel.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.({ preventScroll: true });
    };
  }, []);

  return panelRef;
}
