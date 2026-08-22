"use client";

import { useState, type FormEvent } from "react";
import { CaretDown, CaretRight, Trash } from "@phosphor-icons/react/ssr";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { authInterface } from "@/modules/auth/auth.interface";
import { todosInterface } from "@/modules/todos/todos.interface";
import type { TodoRecord } from "@/types/todo";
import type { EventRecord } from "@/types/event";

interface TodoChecklistProps {
  event: EventRecord;
  initialTodos: TodoRecord[];
  /** Controlled by the embedding card - clicking anywhere on the card toggles this, not just this header (see that card's onClick). */
  expanded: boolean;
  onToggleExpanded: () => void;
}

/**
 * Self-contained, embeddable checklist widget (docs/UI_SPEC.md "Todo Checklist")
 * - owns its own item list, seeded from `initialTodos`, but not its
 * expand/collapse state: the embedding card (EventListItem/RecurringEventCard/
 * PastEventCard) owns that so the *entire card* can toggle it, not just this
 * header row. Mutations call `todosInterface` directly and update local state
 * instead of `router.refresh()`: todos don't affect sort order, urgency, or
 * anything else on the page (docs/PRD.md), so there's nothing else to keep in
 * sync - unlike event CRUD, which DashboardClient's handlers refresh for.
 */
export function TodoChecklist({ event, initialTodos, expanded, onToggleExpanded }: TodoChecklistProps) {
  const [items, setItems] = useState(initialTodos);
  const [newContent, setNewContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doneCount = items.filter((item) => item.is_done).length;

  // On a group event, every member gets their own independent checklist (same
  // todos.user_id scoping as a personal event, unchanged - docs/milestone3/ARCHITECTURE-milestone-3.md).
  // "Bạn" instead of "Checklist" makes that explicit, so nobody mistakes their own
  // progress for a shared/group-wide one (docs/milestone3/UI_SPEC-milestone-3.md).
  const isGroupEvent = event.group_id !== null;

  async function handleAdd(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!newContent.trim() || submitting) return;

    const supabase = createClient();
    const user = await authInterface.getCurrentUser(supabase);
    if (!user) return;

    setSubmitting(true);
    setError(null);
    try {
      const todo = await todosInterface.addTodo(supabase, user.id, event.id, newContent, items.length);
      setItems((current) => [...current, todo]);
      setNewContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that item.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(todo: TodoRecord) {
    const supabase = createClient();
    const user = await authInterface.getCurrentUser(supabase);
    if (!user) return;

    const updated = await todosInterface.toggleTodo(supabase, user.id, todo.id, !todo.is_done);
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function handleDelete(todo: TodoRecord) {
    const supabase = createClient();
    const user = await authInterface.getCurrentUser(supabase);
    if (!user) return;

    await todosInterface.deleteTodo(supabase, user.id, todo.id);
    setItems((current) => current.filter((item) => item.id !== todo.id));
  }

  return (
    <div className="border-t border-primary-container/10">
      {/* Also independently clickable (keyboard-focusable) - stopPropagation on both
          click and keydown so this doesn't also fire the embedding card's own
          onClick/onKeyDown (which toggles the same state) and cancel itself back out. */}
      <button
        type="button"
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          onToggleExpanded();
        }}
        onKeyDown={(keyEvent) => keyEvent.stopPropagation()}
        aria-expanded={expanded}
        className={clsx(
          "flex w-full items-center gap-2 px-5 py-2.5 text-left transition-colors duration-150 hover:bg-surface-elevated",
          !expanded && "rounded-b-lg",
        )}
      >
        {expanded ? (
          <CaretDown size={12} className="text-text-muted" />
        ) : (
          <CaretRight size={12} className="text-text-muted" />
        )}
        <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
          {isGroupEvent ? "Bạn" : "Checklist"}
        </span>
        {items.length > 0 && (
          <span className="ml-auto rounded-full bg-primary/12 px-2 py-0.5 font-mono text-[11px] text-primary tabular-nums">
            {doneCount}/{items.length}
          </span>
        )}
      </button>

      {expanded && (
        // stopPropagation on click *and* keydown - clicking a checkbox, delete icon,
        // or the add-item input must not also bubble up and collapse the card, and
        // neither must typing a space or pressing Enter while typing a new item (the
        // card's onKeyDown otherwise treats any bubbled Space/Enter as "toggle me").
        <div
          className="flex flex-col gap-2 px-5 pb-4"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          onKeyDown={(keyEvent) => keyEvent.stopPropagation()}
        >
          {isGroupEvent && (
            <p className="-mt-1 font-body text-xs text-text-muted italic">
              Đây là checklist của riêng bạn.
            </p>
          )}
          {items.map((item) => (
            <div key={item.id} className="group flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.is_done}
                onChange={() => handleToggle(item)}
                className="size-4 shrink-0 rounded border-outline-variant bg-surface-container-lowest accent-primary-container"
              />
              <span
                className={clsx(
                  "min-w-0 flex-1 truncate font-body text-sm",
                  item.is_done ? "text-text-muted line-through" : "text-on-surface",
                )}
              >
                {item.content}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(item)}
                aria-label={`Xóa ${item.content}`}
                className="rounded p-1 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-error focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
              >
                <Trash size={13} />
              </button>
            </div>
          ))}

          <form onSubmit={handleAdd} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newContent}
              onChange={(inputEvent) => setNewContent(inputEvent.target.value)}
              placeholder="Add an item..."
              className="min-w-0 flex-1 rounded border border-transparent bg-surface-container-lowest px-2.5 py-1.5 font-body text-sm text-on-surface placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
          </form>

          {error && <p className="font-body text-xs text-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
