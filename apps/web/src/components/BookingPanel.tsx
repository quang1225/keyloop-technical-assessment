import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCatalog } from "@/hooks/useCatalog";
import type { ServiceType, Vehicle } from "@/hooks/useCatalog";

export type BookingDraft = {
  vehicleId: string | null;
  serviceTypeId: string | null;
  date: string;
};

type Props = {
  advisorId: string;
  defaultDate?: string;
  onDraftChange: (draft: BookingDraft) => void;
};

const STEPS = ["Vehicle", "Service", "Date"] as const;
const DEFAULT_DATE = "2026-07-15";

export function BookingPanel({ advisorId, defaultDate = DEFAULT_DATE, onDraftChange }: Props) {
  const { vehicles, serviceTypes, isLoading, isError } = useCatalog(advisorId);

  const [step, setStep] = useState(0);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null);
  const [date, setDate] = useState(defaultDate);

  useEffect(() => {
    onDraftChange({ vehicleId, serviceTypeId, date });
  }, [vehicleId, serviceTypeId, date, onDraftChange]);

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

  return (
    <div className="flex h-full w-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold tracking-wide text-[var(--teal)] uppercase">
          New Appointment
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">Book a service slot</h2>
      </div>

      <StepIndicator step={step} onStepClick={setStep} />

      <SelectionSummary
        vehicle={selectedVehicle}
        serviceType={selectedServiceType}
        date={step === 2 ? null : date}
      />

      {isError && (
        <p className="mt-4 text-sm text-[var(--danger)]">
          Could not load catalog data. Is the API running?
        </p>
      )}

      <div className="relative mt-4 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {step === 0 && (
            <StepFrame key="vehicle">
              <VehicleStep
                vehicles={vehicles}
                isLoading={isLoading}
                selectedId={vehicleId}
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
              <DateStep date={date} onChange={setDate} onBack={goBack} />
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
    <div className="mt-4 flex items-center gap-2">
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
              {index + 1}
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
    <div className="mt-4 flex flex-wrap gap-2 text-xs">
      {vehicle && (
        <span className="rounded-full bg-[var(--bg-accent)] px-3 py-1 font-medium text-[var(--teal-deep)]">
          {vehicle.make} {vehicle.model}
        </span>
      )}
      {serviceType && (
        <span className="rounded-full bg-[var(--bg-accent)] px-3 py-1 font-medium text-[var(--teal-deep)]">
          {serviceType.name}
        </span>
      )}
      {date && (
        <span className="rounded-full bg-[var(--bg-accent)] px-3 py-1 font-medium text-[var(--teal-deep)]">
          {date}
        </span>
      )}
    </div>
  );
}

function VehicleStep({
  vehicles,
  isLoading,
  selectedId,
  onSelect,
}: {
  vehicles: Vehicle[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (vehicle: Vehicle) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto pr-1">
      <p className="mb-3 text-sm text-[var(--muted)]">Select the customer&apos;s vehicle</p>
      {isLoading && <p className="text-sm text-[var(--muted)]">Loading vehicles…</p>}
      <div className="flex flex-col gap-2">
        {vehicles.map((vehicle) => (
          <button
            key={vehicle.id}
            type="button"
            onClick={() => onSelect(vehicle)}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
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
          </button>
        ))}
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
    <div className="flex-1 overflow-y-auto pr-1">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">Select the service type</p>
        <BackButton onClick={onBack} />
      </div>
      {isLoading && <p className="text-sm text-[var(--muted)]">Loading service types…</p>}
      <div className="flex flex-col gap-2">
        {serviceTypes.map((serviceType) => (
          <button
            key={serviceType.id}
            type="button"
            onClick={() => onSelect(serviceType)}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              selectedId === serviceType.id
                ? "border-[var(--teal)] bg-[var(--bg-accent)]"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--teal)]"
            }`}
          >
            <p className="text-sm font-semibold text-[var(--ink)]">{serviceType.name}</p>
            <p className="text-xs text-[var(--muted)]">{serviceType.duration_minutes} minutes</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function DateStep({
  date,
  onChange,
  onBack,
}: {
  date: string;
  onChange: (date: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex-1">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">Choose the appointment date</p>
        <BackButton onClick={onBack} />
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)]"
      />
      <p className="mt-4 text-xs text-[var(--muted)]">
        Pick a free slot on the schedule to the right to continue.
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
