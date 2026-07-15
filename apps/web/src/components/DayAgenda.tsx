import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { formatSlotLabel } from "@/lib/slots";
import { useCatalog } from "@/hooks/useCatalog";
import { useSchedule } from "@/hooks/useSchedule";

type Props = {
  advisorId: string;
  date: string;
  onInspect: (appointmentId: string) => void;
  highlightId?: string | null;
};

export function DayAgenda({ advisorId, date, onInspect, highlightId }: Props) {
  const { items, isLoading } = useSchedule(advisorId, date);
  const { vehicles, serviceTypes, bays, technicians } = useCatalog(advisorId);
  const [query, setQuery] = useState("");

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const serviceById = useMemo(() => new Map(serviceTypes.map((s) => [s.id, s])), [serviceTypes]);
  const bayById = useMemo(() => new Map(bays.map((b) => [b.id, b])), [bays]);
  const techById = useMemo(() => new Map(technicians.map((t) => [t.id, t])), [technicians]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    if (!q) return sorted;
    return sorted.filter((item) => {
      const vehicle = vehicleById.get(item.vehicle_id);
      const service = serviceById.get(item.service_type_id);
      const bay = bayById.get(item.bay_id);
      const tech = techById.get(item.technician_id);
      const hay = [
        vehicle?.make,
        vehicle?.model,
        vehicle?.vin,
        vehicle?.customer.full_name,
        service?.name,
        bay?.name,
        tech?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, vehicleById, serviceById, bayById, techById]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-[var(--teal)] uppercase">
            Day Agenda
          </p>
          <h2 className="text-base font-semibold leading-tight text-[var(--ink)]">
            {items.length} appointment{items.length === 1 ? "" : "s"}
          </h2>
        </div>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter customer, bay, tech…"
        className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-1.5 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:bg-[var(--surface)]"
      />

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
        {isLoading && (
          <div className="flex flex-col gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-shimmer h-14 rounded-lg bg-[var(--bg)]" />
            ))}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            {items.length === 0 ? "No appointments yet today." : "No matches."}
          </p>
        )}
        <ul className="flex flex-col gap-1.5">
          {filtered.map((item, index) => {
            const vehicle = vehicleById.get(item.vehicle_id);
            const service = serviceById.get(item.service_type_id);
            const bay = bayById.get(item.bay_id);
            const tech = techById.get(item.technician_id);
            const active = item.id === highlightId;
            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.2 }}
              >
                <button
                  type="button"
                  onClick={() => onInspect(item.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-[var(--teal)] bg-[var(--bg-accent)]"
                      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--teal)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--ink)]">
                      {formatSlotLabel(item.starts_at)}
                      <span className="font-normal text-[var(--muted)]">
                        {" "}
                        – {formatSlotLabel(item.ends_at)}
                      </span>
                    </p>
                    <span className="rounded-md bg-[var(--bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                      {bay?.name ?? "Bay"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--ink)]">
                    {vehicle
                      ? `${vehicle.make} ${vehicle.model} · ${vehicle.customer.full_name}`
                      : "Vehicle"}
                  </p>
                  <p className="truncate text-[11px] text-[var(--muted)]">
                    {service?.name ?? "Service"}
                    {tech ? ` · ${tech.full_name}` : ""}
                  </p>
                </button>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
