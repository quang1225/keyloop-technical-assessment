import type { ReactNode } from "react";
import type { Advisor } from "@/lib/api";

type Props = {
  advisor: Advisor;
  children: ReactNode;
  onSignOut?: () => void;
};

export function SchedulerShell({ advisor, children, onSignOut }: Props) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[var(--teal)] uppercase">
              Keyloop
            </p>
            <h1 className="text-lg font-semibold text-[var(--ink)]">Keyloop Demo Motors</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--muted)]">
              Advisor: <span className="font-medium text-[var(--ink)]">{advisor.name}</span>
            </span>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:border-[var(--teal)] hover:text-[var(--teal)]"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-6">{children}</main>
    </div>
  );
}
