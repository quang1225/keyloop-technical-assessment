import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { formatSlotLabel } from "@/lib/slots";
import { useCancelAppointment } from "@/hooks/useCancelAppointment";
import type { Bay, ServiceType, Technician, Vehicle } from "@/hooks/useCatalog";
import type { ScheduleItem } from "@/hooks/useSchedule";

type Props = {
  advisorId: string;
  date: string;
  item: ScheduleItem;
  vehicle: Vehicle | null;
  serviceType: ServiceType | null;
  bay: Bay | null;
  technician: Technician | null;
  onClose: () => void;
  onCancelled: () => void;
};

export function AppointmentPopover({
  advisorId,
  date,
  item,
  vehicle,
  serviceType,
  bay,
  technician,
  onClose,
  onCancelled,
}: Props) {
  const { cancelAppointment, isPending } = useCancelAppointment(advisorId, date);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isPending]);

  async function handleCancel() {
    setError(null);
    try {
      await cancelAppointment(item.id);
      onCancelled();
      onClose();
    } catch {
      setError("Could not cancel this appointment.");
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[var(--ink)]/35 p-4 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={() => !isPending && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Appointment details"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-[var(--teal)] uppercase">
              Appointment
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-[var(--ink)]">
              {vehicle ? `${vehicle.make} ${vehicle.model}` : "Booked slot"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <dl className="mt-4 grid gap-3 text-sm">
          <Detail
            label="Customer"
            value={vehicle?.customer.full_name ?? "—"}
            sub={vehicle?.customer.email}
          />
          <Detail label="Service" value={serviceType?.name ?? "—"} />
          <Detail
            label="Time"
            value={`${formatSlotLabel(item.starts_at)} – ${formatSlotLabel(item.ends_at)}`}
          />
          <Detail label="Bay" value={bay?.name ?? "—"} />
          <Detail
            label="Technician"
            value={technician?.full_name ?? "—"}
            sub={technician?.skills.slice(0, 3).join(" · ")}
          />
          <Detail label="Status" value={item.status} />
        </dl>

        {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          {!confirmCancel ? (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="w-full rounded-lg border border-[var(--danger)]/40 px-3 py-2 text-sm font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/8"
            >
              Cancel appointment
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-[var(--muted)]">
                This frees the bay and technician for rebooking. Continue?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--muted)] hover:border-[var(--teal)] hover:text-[var(--teal)] disabled:opacity-50"
                >
                  Keep
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleCancel}
                  className="flex-1 rounded-lg bg-[var(--danger)] px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? "Cancelling…" : "Yes, cancel"}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Detail({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)]/70 pb-2 last:border-0">
      <dt className="text-xs font-medium text-[var(--muted)]">{label}</dt>
      <dd className="text-right">
        <span className="font-semibold text-[var(--ink)] capitalize">{value}</span>
        {sub && <span className="mt-0.5 block text-xs font-normal text-[var(--muted)]">{sub}</span>}
      </dd>
    </div>
  );
}
