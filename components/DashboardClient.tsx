"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Nav } from "./Nav";
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
import type { EventInput, EventRecord } from "@/types/event";

interface DashboardClientProps {
  initialEvents: EventRecord[];
  initialRecurringEvents: EventRecord[];
  initialNearestEvent: EventRecord | null;
}

type ModalState =
  | { type: "add" }
  | { type: "edit"; event: EventRecord }
  | { type: "delete"; event: EventRecord }
  | null;

export function DashboardClient({
  initialEvents,
  initialRecurringEvents,
  initialNearestEvent,
}: DashboardClientProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);

  async function handleCreate(input: EventInput) {
    const supabase = createClient();
    const user = await authInterface.getCurrentUser(supabase);
    if (!user) return;

    await eventsInterface.createEvent(supabase, user.id, input);
    setModal(null);
    router.refresh();
  }

  async function handleUpdate(id: string, input: EventInput) {
    const supabase = createClient();
    const user = await authInterface.getCurrentUser(supabase);
    if (!user) return;

    await eventsInterface.updateEvent(supabase, user.id, id, input);
    setModal(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const user = await authInterface.getCurrentUser(supabase);
    if (!user) return;

    await eventsInterface.deleteEvent(supabase, user.id, id);
    setModal(null);
    router.refresh();
  }

  const hasAnyEvents = initialEvents.length > 0 || initialRecurringEvents.length > 0;

  // Past events are pulled out of the Timeline into their own compact section
  // (docs/UI_SPEC.md) - status is presentational/client-side only, so this
  // split is just a render-time filter, no service/DB change involved.
  const activeEvents = initialEvents.filter((event) => getEventStatus(event.deadline).status !== "past");
  const pastEvents = initialEvents.filter((event) => getEventStatus(event.deadline).status === "past");

  return (
    <div className="min-h-dvh">
      <Nav onAddEvent={() => setModal({ type: "add" })} />

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
                  onEdit={(event) => setModal({ type: "edit", event })}
                  onDelete={(event) => setModal({ type: "delete", event })}
                />
              </section>
            )}

            <RecurringEventsSection
              events={initialRecurringEvents}
              onEdit={(event) => setModal({ type: "edit", event })}
              onDelete={(event) => setModal({ type: "delete", event })}
            />

            <PastEventsSection
              events={pastEvents}
              onEdit={(event) => setModal({ type: "edit", event })}
              onDelete={(event) => setModal({ type: "delete", event })}
            />
          </>
        )}
      </main>

      {/*
        Every modal instance gets a `key` unique to what it's editing. Without
        one, React (and AnimatePresence, which tracks children by key) can
        reuse the same EventForm instance across add/edit - or across editing
        two different events in a row - leaking its internal form state.
      */}
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
            description={`"${modal.event.name}" will be permanently deleted.`}
            onConfirm={() => handleDelete(modal.event.id)}
            onCancel={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
