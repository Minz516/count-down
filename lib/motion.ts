/**
 * Shared spring presets (apple-design: "behavior over animation" - a spring,
 * not a fixed-duration tween, so motion/react can retarget and blend velocity
 * if a dialog or popover is interrupted mid-animation instead of jump-cutting).
 * Reduced motion is handled once, globally, by <MotionConfig reducedMotion="user">
 * in app/layout.tsx - these presets don't need their own prefers-reduced-motion check.
 */

// Centered dialogs (ConfirmDialog, EventForm, EditProfileModal, ApiTokenCreateDialog,
// GroupSettingsModal): critically damped, no overshoot - they appear/disappear, nothing
// about opening a form should feel bouncy.
export const DIALOG_SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;

// Anchored popovers (CalendarPopup, the notification/account dropdowns): slightly snappier
// than a full dialog since they're smaller and triggered right next to the pointer.
export const POPOVER_SPRING = { type: "spring", bounce: 0, duration: 0.22 } as const;

// HeroCountdownCard's per-second digit tick: fast and tiny, it should read as a
// crisp "step" rather than something that visibly eases.
export const TICK_SPRING = { type: "spring", bounce: 0, duration: 0.25 } as const;
