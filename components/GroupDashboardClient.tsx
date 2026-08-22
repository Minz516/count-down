"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { GroupNav } from "./GroupNav";
import { GroupSettingsModal } from "./GroupSettingsModal";
import { HeroCountdownCard } from "./HeroCountdownCard";
import { Timeline } from "./Timeline";
import { RecurringEventsSection } from "./RecurringEventsSection";
import { PastEventsSection } from "./PastEventsSection";
import { EventForm } from "./EventForm";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { createClient } from "@/lib/supabase/client";
import { authInterface } from "@/modules/auth/auth.interface";
import { eventsInterface, getEventStatus } from "@/modules/events/events.interface";
import type { GroupRecord, GroupMemberRecord, GroupSettings } from "@/modules/groups/groups.interface";
import type { EventInput, EventRecord } from "@/types/event";
import type { TodoRecord } from "@/types/todo";

interface GroupDashboardClientProps {
  group: GroupRecord;
  initialEvents: EventRecord[];
  initialRecurringEvents: EventRecord[];
  initialNearestEvent: EventRecord | null;
  initialSettings: GroupSettings | null;
  initialMembers: GroupMemberRecord[];
  initialTodosByEvent: Record<string, TodoRecord[]>;
}

type ModalState =
  | { type: "add" }
  | { type: "edit"; event: EventRecord }
  | { type: "delete"; event: EventRecord }
  | null;

/**
 * Group Dashboard - same shape as DashboardClient.tsx, scoped to one group
 * instead of the signed-in user (docs/milestone2/UI_SPEC-milestone-2.md).
 * Group event cards are expandable too now (docs/milestone3/UI_SPEC-milestone-3.md) -
 * `Timeline`/`RecurringEventsSection`/`PastEventsSection` all default
 * `showChecklist` to `true`, so this component no longer overrides it to
 * `false`. Each member's checklist is their own (`TodoChecklist`'s existing
 * per-user scoping via `todosInterface`, unchanged from Milestone 1) - see
 * `TodoChecklist.tsx`'s group-labeling note for how it stays visibly personal.
 */
export function GroupDashboardClient({
  group,
  initialEvents,
  initialRecurringEvents,
  initialNearestEvent,
  initialSettings,
  initialMembers,
  initialTodosByEvent,
}: GroupDashboardClientProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function handleCreate(input: EventInput) {
    const supabase = createClient();
    const user = await authInterface.getCurrentUser(supabase);
    if (!user) return;

    await eventsInterface.createGroupEvent(supabase, user.id, group.id, input);
    setModal(null);
    router.refresh();
  }

  async function handleUpdate(id: string, input: EventInput) {
    const supabase = createClient();
    await eventsInterface.updateGroupEvent(supabase, group.id, id, input);
    setModal(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await eventsInterface.deleteGroupEvent(supabase, group.id, id);
    setModal(null);
    router.refresh();
  }

  const hasAnyEvents = initialEvents.length > 0 || initialRecurringEvents.length > 0;

  const activeEvents = initialEvents.filter((event) => getEventStatus(event.deadline).status !== "past");
  const pastEvents = initialEvents.filter((event) => getEventStatus(event.deadline).status === "past");

  return (
    <div className="min-h-dvh">
      <GroupNav
        groupName={group.name}
        memberCount={group.member_count}
        onAddEvent={() => setModal({ type: "add" })}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="mx-auto flex max-w-[800px] flex-col gap-12 px-4 py-8 sm:px-12">
        {!hasAnyEvents ? (
          <EmptyState onAddEvent={() => setModal({ type: "add" })} />
        ) : (
          <>
            {initialNearestEvent && <HeroCountdownCard event={initialNearestEvent} />}

            {activeEvents.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="font-display text-xl font-medium text-on-surface">Timeline</h2>
                <Timeline
                  events={activeEvents}
                  todosByEvent={initialTodosByEvent}
                  onEdit={(event) => setModal({ type: "edit", event })}
                  onDelete={(event) => setModal({ type: "delete", event })}
                />
              </section>
            )}

            <RecurringEventsSection
              events={initialRecurringEvents}
              todosByEvent={initialTodosByEvent}
              onEdit={(event) => setModal({ type: "edit", event })}
              onDelete={(event) => setModal({ type: "delete", event })}
            />

            <PastEventsSection
              events={pastEvents}
              todosByEvent={initialTodosByEvent}
              onEdit={(event) => setModal({ type: "edit", event })}
              onDelete={(event) => setModal({ type: "delete", event })}
            />
          </>
        )}
      </main>

      <AnimatePresence>
        {modal?.type === "add" && (
          <EventForm key="add" onSubmit={handleCreate} onCancel={() => setModal(null)} />
        )}

        {modal?.type === "edit" && (
          <EventForm
            key={`edit-${modal.event.id}`}
            initialEvent={modal.event}
            onSubmit={(input) => handleUpdate(modal.event.id, input)}
            onCancel={() => setModal(null)}
          />
        )}

        {modal?.type === "delete" && (
          <ConfirmDialog
            key={`delete-${modal.event.id}`}
            title="Delete event?"
            description={`"${modal.event.name}" will be permanently deleted for everyone in the group.`}
            onConfirm={() => handleDelete(modal.event.id)}
            onCancel={() => setModal(null)}
          />
        )}

        {settingsOpen && (
          <GroupSettingsModal
            key="group-settings"
            group={group}
            initialSettings={initialSettings}
            initialMembers={initialMembers}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
