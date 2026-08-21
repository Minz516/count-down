import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// docs/DESIGN.md §8.6 - no shadows, active state is a scale press, contrast verified per variant.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary-container text-on-surface hover:bg-primary-container/90",
  ghost:
    "bg-transparent text-primary border border-primary-container/30 hover:border-primary-container/60",
  danger: "bg-transparent text-error border border-error/40 hover:border-error/70",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded px-4 py-2",
        "font-body text-sm font-medium transition-[transform,background-color,border-color] duration-150",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
});
