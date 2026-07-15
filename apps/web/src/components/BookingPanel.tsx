import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCatalog } from "@/hooks/useCatalog";
import type { ServiceType, Vehicle } from "@/hooks/useCatalog";
import { useAvailability } from "@/hooks/useAvailability";
import { DEMO_DATE, formatDayHeading, formatSlotLabel, nearbyWeekdays } from "@/lib/slots";

export type BookingDraft = {
  vehicleId: string | null;
  serviceTypeId: string | null;
  date: string;
};

type Props = {
  advisorId: string;
  date: string;
  onDateChange: (date: string) => void;
  onDraftChange: (draft: BookingDraft) => void;
  onPickSlot?: (start: string) => void;
  /** Externally drive vehicle selection (e.g. command palette). */
  prefillVehicleId?: string | null;
};

const STEPS = ["Vehicle", "Service", "Date"] as const;

export function BookingPanel({
  advisorId,
  date,
  onDateChange,
  onDraftChange,
  onPickSlot,
  prefillVehicleId,
}: Props) {
  const { vehicles, serviceTypes, isLoading, isError } = useCatalog(advisorId);

  const [step, setStep] = useState(0);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    onDraftChange({ vehicleId, serviceTypeId, date });
  }, [vehicleId, serviceTypeId, date, onDraftChange]);

  useEffect(() => {
    if (!prefillVehicleId) return;
    const vehicle = vehicles.find((v) => v.id === prefillVehicleId);
    if (!vehicle) return;
    setVehicleId(vehicle.id);
    setServiceTypeId(null);
    setStep(1);
  }, [prefillVehicleId, vehicles]);

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const selectedServiceType = serviceTypes.find((s) => s.id === serviceTypeId) ?? null;

  function selectVehicle(vehicle: Vehicle) {
    setVehicleId(vehicle.id);
    setStep(1);
  }

  function selectServiceType(serviceType: ServiceType) {
    setServiceTypeId(serviceType.id);
    setStep(2);
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function resetDraft() {
    setVehicleId(null);
    setServiceTypeId(null);
    setQuery("");
    setStep(0);
    onDateChange(DEMO_DATE);
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-[var(--teal)] uppercase">
            New Appointment
          </p>
          <h2 className="text-base font-semibold leading-tight text-[var(--ink)]">
            Book a service slot
          </h2>
        </div>
        {(vehicleId || serviceTypeId) && (
          <button
            type="button"
            onClick={resetDraft}
            className="text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase transition-colors hover:text-[var(--teal)]"
          >
            Reset
          </button>
        )}
      </div>

      <StepIndicator step={step} onStepClick={setStep} />

      <SelectionSummary
        vehicle={selectedVehicle}
        serviceType={selectedServiceType}
        date={step === 2 ? null : date}
      />

      {isError && (
        <p className="mt-2 text-sm text-[var(--danger)]">
          Could not load catalog data. Is the API running?
        </p>
      )}

      <div className="relative mt-2 min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {step === 0 && (
            <StepFrame key="vehicle">
              <VehicleStep
                vehicles={vehicles}
                isLoading={isLoading}
                selectedId={vehicleId}
                query={query}
                onQueryChange={setQuery}
                onSelect={selectVehicle}
              />
            </StepFrame>
          )}
          {step === 1 && (
            <StepFrame key="service">
              <ServiceStep
                serviceTypes={serviceTypes}
                isLoading={isLoading}
                selectedId={serviceTypeId}
                onSelect={selectServiceType}
                onBack={goBack}
              />
            </StepFrame>
          )}
          {step === 2 && (
            <StepFrame key="date">
              <DateStep
                advisorId={advisorId}
                vehicleId={vehicleId}
                serviceTypeId={serviceTypeId}
                date={date}
                onChange={onDateChange}
                onBack={goBack}
                onPickSlot={onPickSlot}
              />
            </StepFrame>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepFrame({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="absolute inset-0 flex flex-col"
    >
      {children}
    </motion.div>
  );
}

function StepIndicator({ step, onStepClick }: { step: number; onStepClick: (step: number) => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      {STEPS.map((label, index) => {
        const isActive = index === step;
        const isDone = index < step;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onStepClick(index)}
            disabled={index > step}
            className="flex flex-1 items-center gap-2 disabled:cursor-not-allowed"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-[var(--teal)] text-white"
                  : isDone
                    ? "bg-[var(--bg-accent)] text-[var(--teal-deep)]"
                    : "bg-[var(--bg)] text-[var(--muted)]"
              }`}
            >
              {isDone ? "✓" : index + 1}
            </span>
            <span
              className={`text-xs font-medium ${isActive ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SelectionSummary({
  vehicle,
  serviceType,
  date,
}: {
  vehicle: Vehicle | null;
  serviceType: ServiceType | null;
  date: string | null;
}) {
  if (!vehicle && !serviceType) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
      {vehicle && (
        <span className="rounded-full bg-[var(--bg-accent)] px-2.5 py-0.5 font-medium text-[var(--teal-deep)]">
          {vehicle.make} {vehicle.model}
        </span>
      )}
      {serviceType && (
        <span className="rounded-full bg-[var(--bg-accent)] px-2.5 py-0.5 font-medium text-[var(--teal-deep)]">
          {serviceType.name} · {serviceType.duration_minutes}m
        </span>
      )}
      {date && (
        <span className="rounded-full bg-[var(--bg-accent)] px-2.5 py-0.5 font-medium text-[var(--teal-deep)]">
          {formatDayHeading(date)}
        </span>
      )}
    </div>
  );
}

function VehicleStep({
  vehicles,
  isLoading,
  selectedId,
  query,
  onQueryChange,
  onSelect,
}: {
  vehicles: Vehicle[];
  isLoading: boolean;
  selectedId: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (vehicle: Vehicle) => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => {
      const hay = `${v.make} ${v.model} ${v.vin} ${v.customer.full_name}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vehicles, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="mb-2 text-sm text-[var(--muted)]">Select the customer&apos;s vehicle</p>
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search make, VIN, or customer…"
        className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-2 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:bg-[var(--surface)]"
      />
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {isLoading && (
          <div className="flex flex-col gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-shimmer h-16 rounded-lg bg-[var(--bg)]" />
            ))}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-[var(--muted)]">No vehicles match “{query}”.</p>
        )}
        <div className="flex flex-col gap-1.5">
          {filtered.map((vehicle, index) => (
            <motion.button
              key={vehicle.id}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.2 }}
              onClick={() => onSelect(vehicle)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                selectedId === vehicle.id
                  ? "border-[var(--teal)] bg-[var(--bg-accent)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--teal)]"
              }`}
            >
              <p className="text-sm font-semibold text-[var(--ink)]">
                {vehicle.make} {vehicle.model}
              </p>
              <p className="text-xs text-[var(--muted)]">VIN {vehicle.vin}</p>
              <p className="text-xs text-[var(--muted)]">{vehicle.customer.full_name}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ServiceStep({
  serviceTypes,
  isLoading,
  selectedId,
  onSelect,
  onBack,
}: {
  serviceTypes: ServiceType[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (serviceType: ServiceType) => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">Select the service type</p>
        <BackButton onClick={onBack} />
      </div>
      {isLoading && (
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-shimmer h-14 rounded-lg bg-[var(--bg)]" />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {serviceTypes.map((serviceType, index) => (
          <motion.button
            key={serviceType.id}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.2 }}
            onClick={() => onSelect(serviceType)}
            className={`rounded-lg border px-3 py-2 text-left transition-colors ${
              selectedId === serviceType.id
                ? "border-[var(--teal)] bg-[var(--bg-accent)]"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--teal)]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--ink)]">{serviceType.name}</p>
              <span className="rounded-md bg-[var(--bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                {serviceType.duration_minutes} min
              </span>
            </div>
            {serviceType.required_skills.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {serviceType.required_skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-[var(--bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function DateStep({
  advisorId,
  vehicleId,
  serviceTypeId,
  date,
  onChange,
  onBack,
  onPickSlot,
}: {
  advisorId: string;
  vehicleId: string | null;
  serviceTypeId: string | null;
  date: string;
  onChange: (date: string) => void;
  onBack: () => void;
  onPickSlot?: (start: string) => void;
}) {
  const chips = nearbyWeekdays(DEMO_DATE, 5);
  const { freeSlots, isLoading } = useAvailability(advisorId, {
    vehicleId,
    serviceTypeId,
    date,
  });
  const suggested = freeSlots.slice(0, 6);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">Choose the appointment date</p>
        <BackButton onClick={onBack} />
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const active = chip === date;
          return (
            <button
              key={chip}
              type="button"
              onClick={() => onChange(chip)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-[var(--teal)] bg-[var(--bg-accent)] text-[var(--teal-deep)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--teal)]"
              }`}
            >
              {formatDayHeading(chip)}
            </button>
          );
        })}
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)]"
      />

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
          Suggested free times
        </p>
        {isLoading && <p className="text-xs text-[var(--muted)]">Checking availability…</p>}
        {!isLoading && suggested.length === 0 && (
          <p className="text-xs text-[var(--muted)]">No free slots — try another date.</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {suggested.map((iso) => (
            <button
              key={iso}
              type="button"
              onClick={() => onPickSlot?.(iso)}
              className="rounded-lg border border-[var(--teal)]/35 bg-[var(--bg-accent)]/70 px-2.5 py-1.5 text-xs font-semibold text-[var(--teal-deep)] transition-colors hover:bg-[var(--bg-accent)]"
            >
              {formatSlotLabel(iso)}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">
        Or pick a free cell on the board. Use ← → to cycle free slots.
      </p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium text-[var(--teal)] hover:text-[var(--teal-deep)]"
    >
      ← Back
    </button>
  );
}
