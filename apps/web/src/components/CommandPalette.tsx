import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCatalog } from "@/hooks/useCatalog";
import type { Vehicle } from "@/hooks/useCatalog";

export type CommandAction =
  | { type: "select-vehicle"; vehicle: Vehicle }
  | { type: "jump-first-free" }
  | { type: "open-agenda" }
  | { type: "today" };

type Props = {
  open: boolean;
  advisorId: string;
  onClose: () => void;
  onAction: (action: CommandAction) => void;
  hasFreeSlots: boolean;
};

export function CommandPalette({ open, advisorId, onClose, onAction, hasFreeSlots }: Props) {
  const { vehicles } = useCatalog(advisorId);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const vehicleMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles.slice(0, 6);
    return vehicles
      .filter((v) => {
        const hay = `${v.make} ${v.model} ${v.vin} ${v.customer.full_name}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [vehicles, query]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--ink)]/40 p-4 pt-[12vh]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        >
          <div className="border-b border-[var(--border)] px-4 py-3">
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vehicles or run a command…"
              className="w-full bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto p-2">
            <li>
              <CommandRow
                label="Jump to first free slot"
                hint="↵"
                disabled={!hasFreeSlots}
                onClick={() => {
                  onAction({ type: "jump-first-free" });
                  onClose();
                }}
              />
            </li>
            <li>
              <CommandRow
                label="Focus day agenda"
                onClick={() => {
                  onAction({ type: "open-agenda" });
                  onClose();
                }}
              />
            </li>
            <li>
              <CommandRow
                label="Go to demo day"
                onClick={() => {
                  onAction({ type: "today" });
                  onClose();
                }}
              />
            </li>
            {vehicleMatches.length > 0 && (
              <li className="px-2 pb-1 pt-2 text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Vehicles
              </li>
            )}
            {vehicleMatches.map((vehicle) => (
              <li key={vehicle.id}>
                <CommandRow
                  label={`${vehicle.make} ${vehicle.model}`}
                  detail={`${vehicle.customer.full_name} · ${vehicle.vin}`}
                  onClick={() => {
                    onAction({ type: "select-vehicle", vehicle });
                    onClose();
                  }}
                />
              </li>
            ))}
          </ul>
          <div className="border-t border-[var(--border)] px-4 py-2 text-[10px] text-[var(--muted)]">
            <kbd className="rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5">⌘K</kbd>
            {" / "}
            <kbd className="rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5">Ctrl+K</kbd>
            {" to open · Esc to close"}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function CommandRow({
  label,
  detail,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  detail?: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--bg-accent)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span>
        <span className="block text-sm font-medium text-[var(--ink)]">{label}</span>
        {detail && <span className="block text-xs text-[var(--muted)]">{detail}</span>}
      </span>
      {hint && <span className="text-[10px] text-[var(--muted)]">{hint}</span>}
    </button>
  );
}
