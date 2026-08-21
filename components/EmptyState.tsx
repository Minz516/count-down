import { Plus } from "@phosphor-icons/react/ssr";
import { Button } from "./Button";

export function EmptyState({ onAddEvent }: { onAddEvent: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-primary-container/10 bg-surface-container px-6 py-16 text-center">
      <h2 className="font-display text-xl font-semibold text-on-surface">No events yet</h2>
      <p className="max-w-sm font-body text-sm text-text-muted">
        Add your first deadline to start the countdown.
      </p>
      <Button onClick={onAddEvent}>
        <Plus size={16} weight="bold" />
        Add Event
      </Button>
    </div>
  );
}
