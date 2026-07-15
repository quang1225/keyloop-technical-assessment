import type { ReactNode } from "react";
import { motion } from "motion/react";
import type { Advisor } from "@/lib/api";
import { DEMO_CLOCK } from "@/lib/slots";

type Props = {
  advisor: Advisor;
  children: ReactNode;
  onSignOut?: () => void;
  appointmentCount?: number;
};

export function SchedulerShell({ advisor, children, onSignOut, appointmentCount }: Props) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 py-2 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 18 }}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--teal)] text-sm font-bold text-white shadow-sm"
              aria-hidden
            >
              K
            </motion.div>
            <div>
              <p className="text-[10px] font-semibold tracking-wide text-[var(--teal)] uppercase">
                Keyloop
              </p>
              <h1 className="text-base font-semibold leading-tight text-[var(--ink)]">
                Keyloop Demo Motors
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {typeof appointmentCount === "number" && (
              <span className="hidden rounded-full bg-[var(--bg-accent)] px-2.5 py-1 text-xs font-semibold text-[var(--teal-deep)] sm:inline">
                {appointmentCount} booked
              </span>
            )}
            <span className="hidden items-center gap-1.5 text-xs text-[var(--muted)] lg:inline-flex">
              <kbd className="rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[10px] font-semibold">
                ⌘K
              </kbd>
              Command
            </span>
            <span className="hidden text-xs text-[var(--muted)] md:inline">
              Demo clock {DEMO_CLOCK}
            </span>
            <span className="text-sm text-[var(--muted)]">
              Advisor: <span className="font-medium text-[var(--ink)]">{advisor.name}</span>
            </span>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-md border border-[var(--border)] px-2.5 py-1 text-sm text-[var(--muted)] transition-colors hover:border-[var(--teal)] hover:text-[var(--teal)]"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col p-3">{children}</main>
    </div>
  );
}
