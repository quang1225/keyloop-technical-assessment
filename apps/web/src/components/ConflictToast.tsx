import { useEffect } from "react";
import { motion } from "motion/react";

type Props = {
  onDismiss: () => void;
  autoDismissMs?: number;
};

export function ConflictToast({ onDismiss, autoDismissMs = 5000 }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [onDismiss, autoDismissMs]);

  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="fixed bottom-6 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 items-start gap-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--surface)] px-4 py-3 shadow-lg"
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--danger)]/10 text-[var(--danger)]">
        !
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[var(--ink)]">
          That slot was just taken — pick another
        </p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          The schedule has been refreshed with the latest availability.
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md px-1.5 py-0.5 text-sm text-[var(--muted)] transition-colors hover:text-[var(--teal-deep)]"
      >
        ✕
      </button>
    </motion.div>
  );
}
