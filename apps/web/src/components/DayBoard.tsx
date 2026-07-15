import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  bayUtilization,
  DEMO_CLOCK,
  formatDayHeading,
  formatSlotLabel,
  shiftDate,
  TIME_ZONE,
} from "@/lib/slots";
import { useCatalog } from "@/hooks/useCatalog";
import { useSchedule } from "@/hooks/useSchedule";
import type { ScheduleItem } from "@/hooks/useSchedule";
import { useAvailability } from "@/hooks/useAvailability";
import type { BookingDraft } from "@/components/BookingPanel";
import { AppointmentPopover } from "@/components/AppointmentPopover";

const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 17 * 60;
const SLOT_MIN = 30;

export type SelectedSlot = { start: string; bayId: string };

type Props = {
  advisorId: string;
  draft: BookingDraft;
  selectedSlot: SelectedSlot | null;
  onSelectSlot: (slot: SelectedSlot) => void;
  onDateChange: (date: string) => void;
  justBookedId?: string | null;
  inspectId?: string | null;
  onInspectIdChange?: (id: string | null) => void;
  onCancelled?: () => void;
};

function hhmmToMinutes(label: string): number {
  const [hour, minute] = label.split(":").map(Number);
  return hour * 60 + minute;
}

function buildRows() {
  const rows: { minute: number; label: string; isHourMark: boolean }[] = [];
  for (let m = DAY_START_MIN; m < DAY_END_MIN; m += SLOT_MIN) {
    const hour = Math.floor(m / 60);
    const minute = m % 60;
    rows.push({
      minute: m,
      label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      isHourMark: minute === 0,
    });
  }
  return rows;
}

export function DayBoard({
  advisorId,
  draft,
  selectedSlot,
  onSelectSlot,
  onDateChange,
  justBookedId,
  inspectId: inspectIdProp,
  onInspectIdChange,
  onCancelled,
}: Props) {
  const { bays, vehicles, serviceTypes, technicians } = useCatalog(advisorId);
  const { items, isLoading: scheduleLoading } = useSchedule(advisorId, draft.date);
  const { freeSlots, isLoading: availabilityLoading } = useAvailability(advisorId, {
    vehicleId: draft.vehicleId,
    serviceTypeId: draft.serviceTypeId,
    date: draft.date,
  });
  const [inspectIdLocal, setInspectIdLocal] = useState<string | null>(null);
  const inspectId = inspectIdProp !== undefined ? inspectIdProp : inspectIdLocal;
  const setInspectId = onInspectIdChange ?? setInspectIdLocal;
  const [hoverSlot, setHoverSlot] = useState<{ bayId: string; rowIndex: number } | null>(null);
  const [techFilter, setTechFilter] = useState<string>("all");

  const rows = useMemo(buildRows, []);
  const selectedService = serviceTypes.find((s) => s.id === draft.serviceTypeId) ?? null;
  const spanRows = selectedService
    ? Math.max(1, Math.round(selectedService.duration_minutes / SLOT_MIN))
    : 1;

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const serviceTypeById = useMemo(
    () => new Map(serviceTypes.map((s) => [s.id, s])),
    [serviceTypes],
  );
  const techById = useMemo(() => new Map(technicians.map((t) => [t.id, t])), [technicians]);
  const bayById = useMemo(() => new Map(bays.map((b) => [b.id, b])), [bays]);

  const freeByLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const iso of freeSlots) {
      map.set(formatSlotLabel(iso, TIME_ZONE), iso);
    }
    return map;
  }, [freeSlots]);

  const utilizationByBay = useMemo(() => {
    const map = new Map<string, number>();
    for (const bay of bays) {
      const bayItems = items.filter((i) => i.bay_id === bay.id);
      map.set(bay.id, bayUtilization(bayItems, TIME_ZONE));
    }
    return map;
  }, [bays, items]);

  const overallUtilization = useMemo(() => {
    if (bays.length === 0) return 0;
    let sum = 0;
    for (const bay of bays) sum += utilizationByBay.get(bay.id) ?? 0;
    return sum / bays.length;
  }, [bays, utilizationByBay]);

  const blocksByBay = useMemo(() => {
    const map = new Map<
      string,
      {
        rowStart: number;
        rowSpan: number;
        label: string;
        sublabel: string;
        tech: string;
        id: string;
        item: ScheduleItem;
        dimmed: boolean;
      }[]
    >();
    for (const item of items) {
      const startMin = hhmmToMinutes(formatSlotLabel(item.starts_at, TIME_ZONE));
      const endMin = hhmmToMinutes(formatSlotLabel(item.ends_at, TIME_ZONE));
      const rowStart = Math.max(0, Math.round((startMin - DAY_START_MIN) / SLOT_MIN));
      const rowSpan = Math.max(1, Math.round((endMin - startMin) / SLOT_MIN));
      const vehicle = vehicleById.get(item.vehicle_id);
      const serviceType = serviceTypeById.get(item.service_type_id);
      const tech = techById.get(item.technician_id);
      const dimmed = techFilter !== "all" && item.technician_id !== techFilter;
      const block = {
        rowStart,
        rowSpan,
        label: vehicle ? `${vehicle.make} ${vehicle.model}` : "Booked",
        sublabel: serviceType?.name ?? "",
        tech: tech?.full_name ?? "",
        id: item.id,
        item,
        dimmed,
      };
      const list = map.get(item.bay_id) ?? [];
      list.push(block);
      map.set(item.bay_id, list);
    }
    return map;
  }, [items, vehicleById, serviceTypeById, techById, techFilter]);

  const occupiedRowsByBay = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const [bayId, blocks] of blocksByBay) {
      const occupied = new Set<number>();
      for (const block of blocks) {
        for (let r = block.rowStart; r < block.rowStart + block.rowSpan; r += 1) {
          occupied.add(r);
        }
      }
      map.set(bayId, occupied);
    }
    return map;
  }, [blocksByBay]);

  const selectedStartRow = useMemo(() => {
    if (!selectedSlot) return -1;
    const label = formatSlotLabel(selectedSlot.start, TIME_ZONE);
    return rows.findIndex((r) => r.label === label);
  }, [selectedSlot, rows]);

  const canShowAvailability = Boolean(draft.vehicleId && draft.serviceTypeId);
  const freeCount = freeSlots.length;
  const inspected = inspectId ? (items.find((i) => i.id === inspectId) ?? null) : null;

  function jumpToFirstFree() {
    if (freeSlots.length === 0 || bays.length === 0) return;
    const firstIso = freeSlots[0];
    const label = formatSlotLabel(firstIso, TIME_ZONE);
    const rowIndex = rows.findIndex((r) => r.label === label);
    for (const bay of bays) {
      if (rowIndex < 0) continue;
      const occupied = occupiedRowsByBay.get(bay.id)?.has(rowIndex) ?? false;
      if (!occupied) {
        onSelectSlot({ start: firstIso, bayId: bay.id });
        return;
      }
    }
    onSelectSlot({ start: firstIso, bayId: bays[0].id });
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => onDateChange(shiftDate(draft.date, -1))}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-sm text-[var(--muted)] transition-colors hover:border-[var(--teal)] hover:text-[var(--teal)]"
          >
            ‹
          </button>
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-[var(--teal)] uppercase">
              Day Schedule
            </p>
            <h2 className="text-base font-semibold leading-tight text-[var(--ink)]">
              {formatDayHeading(draft.date)}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => onDateChange(shiftDate(draft.date, 1))}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-sm text-[var(--muted)] transition-colors hover:border-[var(--teal)] hover:text-[var(--teal)]"
          >
            ›
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <UtilizationPill value={overallUtilization} />
          <span className="rounded-full bg-[var(--bg)] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase">
            Demo clock · {DEMO_CLOCK}
          </span>
          {canShowAvailability && !availabilityLoading && (
            <span className="rounded-full bg-[var(--bg-accent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--teal-deep)]">
              {freeCount} free slot{freeCount === 1 ? "" : "s"}
            </span>
          )}
          {canShowAvailability && freeCount > 0 && (
            <button
              type="button"
              onClick={jumpToFirstFree}
              className="rounded-md border border-[var(--teal)]/40 px-2 py-1 text-xs font-semibold text-[var(--teal-deep)] transition-colors hover:bg-[var(--bg-accent)]"
            >
              Jump to first free
            </button>
          )}
          <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            Tech
            <select
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs text-[var(--ink)] outline-none focus:border-[var(--teal)]"
            >
              <option value="all">All</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-2 flex shrink-0 flex-wrap items-center gap-3 text-[10px] text-[var(--muted)]">
        <LegendSwatch className="border-[var(--teal)]/30 bg-[var(--bg-accent)]/80" label="Free" />
        <LegendSwatch className="bg-[var(--teal-deep)]" label="Booked" />
        <LegendSwatch className="bg-[var(--teal)]/30 ring-1 ring-[var(--teal)]" label="Selected" />
        <LegendSwatch
          className="border-[var(--amber)]/50 bg-[var(--amber)]/35"
          label="Duration preview"
        />
        {!canShowAvailability && (
          <span>Select a vehicle and service to see free slots</span>
        )}
        {canShowAvailability && availabilityLoading && <span>Checking availability…</span>}
      </div>

      <div className="relative mt-2 min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        {scheduleLoading || bays.length === 0 ? (
          <BoardSkeleton bayCount={4} rowCount={8} />
        ) : (
          <div
            className="grid h-full min-w-[560px]"
            style={{
              gridTemplateColumns: `56px repeat(${bays.length}, minmax(120px, 1fr))`,
              gridTemplateRows: `28px repeat(${rows.length}, minmax(0, 1fr))`,
            }}
          >
            <div className="sticky top-0 z-10 col-start-1 row-start-1 bg-[var(--surface)]" />
            {bays.map((bay, bayIndex) => {
              const util = utilizationByBay.get(bay.id) ?? 0;
              return (
                <div
                  key={bay.id}
                  className="sticky top-0 z-10 flex flex-col items-center justify-center gap-0.5 border-b border-[var(--border)] bg-[var(--surface)] px-1"
                  style={{ gridColumn: bayIndex + 2, gridRow: 1 }}
                  title={`${Math.round(util * 100)}% utilized`}
                >
                  <span className="text-sm font-semibold text-[var(--ink)]">{bay.name}</span>
                  <span className="utilization-track w-full max-w-[72px]">
                    <span
                      className="utilization-fill"
                      style={{
                        width: `${Math.round(util * 100)}%`,
                        background:
                          util > 0.75
                            ? "var(--amber)"
                            : util > 0.4
                              ? "var(--teal)"
                              : "var(--teal-deep)",
                      }}
                    />
                  </span>
                </div>
              );
            })}

            <div
              className="pointer-events-none z-[6] flex items-center"
              style={{ gridColumn: "1 / -1", gridRow: 2 }}
            >
              <div className="now-line h-px w-full" />
            </div>

            {rows.map((row, rowIndex) => (
              <div
                key={row.label}
                className={`flex items-start justify-end pr-2 text-xs ${
                  row.isHourMark ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"
                }`}
                style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
              >
                {row.isHourMark ? row.label : ""}
              </div>
            ))}

            {bays.map((bay, bayIndex) =>
              rows.map((row, rowIndex) => {
                const occupied = occupiedRowsByBay.get(bay.id)?.has(rowIndex) ?? false;
                const freeIso = freeByLabel.get(row.label);
                const isFree = canShowAvailability && !occupied && Boolean(freeIso);
                const isSelected =
                  selectedSlot?.bayId === bay.id && selectedSlot.start === freeIso;

                const previewActive =
                  canShowAvailability &&
                  hoverSlot?.bayId === bay.id &&
                  rowIndex >= hoverSlot.rowIndex &&
                  rowIndex < hoverSlot.rowIndex + spanRows;

                const inSelectedSpan =
                  selectedSlot?.bayId === bay.id &&
                  selectedStartRow >= 0 &&
                  rowIndex >= selectedStartRow &&
                  rowIndex < selectedStartRow + spanRows &&
                  !occupied;

                return (
                  <button
                    key={`${bay.id}-${row.label}`}
                    type="button"
                    disabled={!isFree}
                    title={isFree ? `${bay.name} · ${row.label}` : undefined}
                    onMouseEnter={() => isFree && setHoverSlot({ bayId: bay.id, rowIndex })}
                    onMouseLeave={() => setHoverSlot(null)}
                    onClick={() => freeIso && onSelectSlot({ start: freeIso, bayId: bay.id })}
                    style={{ gridColumn: bayIndex + 2, gridRow: rowIndex + 2 }}
                    className={`border-b border-l border-[var(--border)]/60 transition-colors ${
                      row.isHourMark ? "border-t border-t-[var(--border)]" : ""
                    } ${
                      isSelected
                        ? "bg-[var(--teal)]/25 ring-2 ring-inset ring-[var(--teal)]"
                        : previewActive || inSelectedSpan
                          ? "bg-[var(--amber)]/30"
                          : isFree
                            ? "cursor-pointer bg-[var(--bg-accent)]/50 hover:bg-[var(--bg-accent)]"
                            : occupied
                              ? "bg-transparent"
                              : "cursor-default bg-transparent"
                    }`}
                    aria-label={isFree ? `Book ${bay.name} at ${row.label}` : undefined}
                  />
                );
              }),
            )}

            {bays.map((bay, bayIndex) =>
              (blocksByBay.get(bay.id) ?? []).map((block) => {
                const isJustBooked = block.id === justBookedId;
                return (
                  <motion.button
                    key={block.id}
                    type="button"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={
                      isJustBooked
                        ? { opacity: 1, scale: [0.96, 1.06, 1] }
                        : { opacity: 1, scale: 1 }
                    }
                    transition={
                      isJustBooked ? { duration: 0.6, ease: "easeOut" } : { duration: 0.2 }
                    }
                    onClick={() => setInspectId(block.id)}
                    style={{
                      gridColumn: bayIndex + 2,
                      gridRow: `${block.rowStart + 2} / span ${block.rowSpan}`,
                    }}
                    className={`z-[5] m-0.5 flex flex-col justify-center overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-white shadow-sm transition-[filter,opacity] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-white/60 ${
                      block.dimmed ? "opacity-25" : ""
                    } ${
                      isJustBooked
                        ? "border-[var(--teal)] bg-[var(--teal)] shadow-[0_0_0_4px_rgba(13,148,136,0.25)]"
                        : "border-[var(--teal-deep)]/30 bg-[var(--teal-deep)]"
                    }`}
                  >
                    <p className="truncate text-[11px] font-semibold leading-tight">{block.label}</p>
                    {block.sublabel && (
                      <p className="truncate text-[9px] leading-tight text-white/80">
                        {block.sublabel}
                      </p>
                    )}
                    {block.tech && block.rowSpan > 1 && (
                      <p className="truncate text-[9px] leading-tight text-white/70">{block.tech}</p>
                    )}
                  </motion.button>
                );
              }),
            )}
          </div>
        )}

        {canShowAvailability && !availabilityLoading && freeCount === 0 && !scheduleLoading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 text-center shadow-md">
              <p className="text-sm font-semibold text-[var(--ink)]">No free slots this day</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Try another date or a shorter service.
              </p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {inspected && (
          <AppointmentPopover
            key={inspected.id}
            advisorId={advisorId}
            date={draft.date}
            item={inspected}
            vehicle={vehicleById.get(inspected.vehicle_id) ?? null}
            serviceType={serviceTypeById.get(inspected.service_type_id) ?? null}
            bay={bayById.get(inspected.bay_id) ?? null}
            technician={techById.get(inspected.technician_id) ?? null}
            onClose={() => setInspectId(null)}
            onCancelled={() => onCancelled?.()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function UtilizationPill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span
      className="rounded-full bg-[var(--bg)] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase"
      title="Average bay occupancy for the working day"
    >
      Bay load {pct}%
    </span>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm border ${className}`} />
      {label}
    </span>
  );
}

function BoardSkeleton({ bayCount, rowCount }: { bayCount: number; rowCount: number }) {
  return (
    <div
      className="grid h-full min-w-[560px] gap-px"
      style={{ gridTemplateColumns: `56px repeat(${bayCount}, 1fr)` }}
    >
      {Array.from({ length: (rowCount + 1) * (bayCount + 1) }).map((_, i) => (
        <div key={i} className="skeleton-shimmer rounded-sm bg-[var(--bg)]" />
      ))}
    </div>
  );
}
