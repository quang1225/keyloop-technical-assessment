import { useState } from "react";
import { motion } from "motion/react";
import { formatSlotLabel } from "@/lib/slots";
import { useCreateAppointment } from "@/hooks/useCreateAppointment";
import type { Bay, ServiceType, Vehicle } from "@/hooks/useCatalog";
import type { ScheduleItem } from "@/hooks/useSchedule";

type Props = {
  advisorId: string;
  date: string;
  vehicle: Vehicle;
  serviceType: ServiceType;
  bay: Bay | null;
  start: string;
  onClose: () => void;
  onConfirmed: (appointment: ScheduleItem) => void;
  onConflict: () => void;
};

export function ConfirmDialog({
  advisorId,
  date,
  vehicle,
  serviceType,
  bay,
  start,
  onClose,
  onConfirmed,
  onConflict,
}: Props) {
  const { createAppointment, isPending } = useCreateAppointment(advisorId, date);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    try {
      const appointment = await createAppointment({
        vehicleId: vehicle.id,
        serviceTypeId: serviceType.id,
        start,
        bayId: bay?.id ?? null,
      });
      setSuccess(true);
      window.setTimeout(() => onConfirmed(appointment), 650);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 409) {
        onConflict();
        onClose();
        return;
      }
      setError("Could not book this slot. Please try again.");
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--ink)]/40 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => !isPending && !success && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm booking"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg"
      >
        {success ? (
          <SuccessState />
        ) : (
          <>
            <p className="text-xs font-semibold tracking-wide text-[var(--teal)] uppercase">
              Confirm appointment
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">Ready to book?</h2>

            <dl className="mt-5 flex flex-col gap-3 text-sm">
              <Row label="Vehicle" value={`${vehicle.make} ${vehicle.model}`} sub={vehicle.customer.full_name} />
              <Row label="Service" value={serviceType.name} sub={`${serviceType.duration_minutes} minutes`} />
              <Row label="Time" value={formatSlotLabel(start)} sub={date} />
              <Row label="Bay" value={bay?.name ?? "To be assigned"} />
            </dl>

            {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:border-[var(--teal)] hover:text-[var(--teal)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--teal-deep)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Booking…" : "Confirm booking"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs font-medium text-[var(--muted)]">{label}</dt>
      <dd className="text-right text-sm font-semibold text-[var(--ink)]">
        {value}
        {sub && <span className="ml-1.5 font-normal text-[var(--muted)]">· {sub}</span>}
      </dd>
    </div>
  );
}

function SuccessState() {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 18 }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--teal)] text-white"
      >
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-7 w-7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.15, duration: 0.35, ease: "easeOut" }}
        >
          <motion.path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </motion.div>
      <p className="text-sm font-semibold text-[var(--ink)]">Booking confirmed</p>
    </div>
  );
}
