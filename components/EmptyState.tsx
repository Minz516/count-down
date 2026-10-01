import { Plus } from "@phosphor-icons/react/ssr";
import { Button } from "./Button";
import { useT } from "./LocaleProvider";

export function EmptyState({ onAddEvent }: { onAddEvent: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-primary-container/10 bg-surface-container px-6 py-16 text-center">
      <h2 className="text-balance font-display text-xl font-semibold text-on-surface">{t("dashboard.empty.title")}</h2>
      <p className="max-w-sm font-body text-sm text-text-muted">
        {t("dashboard.empty.body")}
      </p>
      <Button onClick={onAddEvent}>
        <Plus aria-hidden="true" size={16} weight="bold" />
        {t("nav.addEvent")}
      </Button>
    </div>
  );
}
