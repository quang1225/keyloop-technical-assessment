import { useMemo } from "react";
import { motion } from "motion/react";
import { formatSlotLabel } from "@/lib/slots";
import { useCatalog } from "@/hooks/useCatalog";
import { useSchedule } from "@/hooks/useSchedule";
import { useAvailability } from "@/hooks/useAvailability";
import type { BookingDraft } from "@/components/BookingPanel";

const TIME_ZONE = "Europe/London";
const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 17 * 60;
const SLOT_MIN = 30;
const ROW_HEIGHT = 44;

export type SelectedSlot = { start: string; bayId: string };

type Props = {
  advisorId: string;
  draft: BookingDraft;
  selectedSlot: SelectedSlot | null;
  onSelectSlot: (slot: SelectedSlot) => void;
  justBookedId?: string | null;
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

export function DayBoard({ advisorId, draft, selectedSlot, onSelectSlot, justBookedId }: Props) {
  const { bays, vehicles, serviceTypes } = useCatalog(advisorId);
  const { items, isLoading: scheduleLoading } = useSchedule(advisorId, draft.date);
  const { freeSlots, isLoading: availabilityLoading } = useAvailability(advisorId, {
    vehicleId: draft.vehicleId,
    serviceTypeId: draft.serviceTypeId,
    date: draft.date,
  });

  const rows = useMemo(buildRows, []);

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const serviceTypeById = useMemo(
    () => new Map(serviceTypes.map((s) => [s.id, s])),
    [serviceTypes],
  );

  const freeByLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const iso of freeSlots) {
      map.set(formatSlotLabel(iso, TIME_ZONE), iso);
    }
    return map;
  }, [freeSlots]);

  const blocksByBay = useMemo(() => {
    const map = new Map<
      string,
      { rowStart: number; rowSpan: number; label: string; sublabel: string; id: string }[]
    >();
    for (const item of items) {
      const startMin = hhmmToMinutes(formatSlotLabel(item.starts_at, TIME_ZONE));
      const endMin = hhmmToMinutes(formatSlotLabel(item.ends_at, TIME_ZONE));
      const rowStart = Math.max(0, Math.round((startMin - DAY_START_MIN) / SLOT_MIN));
      const rowSpan = Math.max(1, Math.round((endMin - startMin) / SLOT_MIN));
      const vehicle = vehicleById.get(item.vehicle_id);
      const serviceType = serviceTypeById.get(item.service_type_id);
      const block = {
        rowStart,
        rowSpan,
        label: vehicle ? `${vehicle.make} ${vehicle.model}` : "Booked",
        sublabel: serviceType?.name ?? "",
        id: item.id,
      };
      const list = map.get(item.bay_id) ?? [];
      list.push(block);
      map.set(item.bay_id, list);
    }
    return map;
  }, [items, vehicleById, serviceTypeById]);

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

  const canShowAvailability = Boolean(draft.vehicleId && draft.serviceTypeId);

  return (
    <div className="flex h-full w-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[var(--teal)] uppercase">
            Day Schedule
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">{draft.date}</h2>
        </div>
        {!canShowAvailability && (
          <p className="text-xs text-[var(--muted)]">
            Select a vehicle and service to see free slots
          </p>
        )}
        {canShowAvailability && availabilityLoading && (
          <p className="text-xs text-[var(--muted)]">Checking availability…</p>
        )}
      </div>

      <div className="mt-4 flex-1 overflow-auto">
        {scheduleLoading || bays.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Loading schedule…</p>
        ) : (
          <div
            className="grid min-w-[560px]"
            style={{
              gridTemplateColumns: `72px repeat(${bays.length}, minmax(140px, 1fr))`,
              gridTemplateRows: `36px repeat(${rows.length}, ${ROW_HEIGHT}px)`,
            }}
          >
            <div className="sticky top-0 z-10 col-start-1 row-start-1 bg-[var(--surface)]" />
            {bays.map((bay, bayIndex) => (
              <div
                key={bay.id}
                className="sticky top-0 z-10 flex items-center justify-center border-b border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--ink)]"
                style={{ gridColumn: bayIndex + 2, gridRow: 1 }}
              >
                {bay.name}
              </div>
            ))}

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

                return (
                  <button
                    key={`${bay.id}-${row.label}`}
                    type="button"
                    disabled={!isFree}
                    onClick={() => freeIso && onSelectSlot({ start: freeIso, bayId: bay.id })}
                    style={{ gridColumn: bayIndex + 2, gridRow: rowIndex + 2 }}
                    className={`border-b border-l border-[var(--border)]/60 transition-colors ${
                      row.isHourMark ? "border-t border-t-[var(--border)]" : ""
                    } ${
                      isSelected
                        ? "bg-[var(--teal)]/25 ring-2 ring-inset ring-[var(--teal)]"
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
                  <motion.div
                    key={block.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={
                      isJustBooked
                        ? { opacity: 1, scale: [0.96, 1.06, 1] }
                        : { opacity: 1, scale: 1 }
                    }
                    transition={
                      isJustBooked ? { duration: 0.6, ease: "easeOut" } : { duration: 0.2 }
                    }
                    style={{
                      gridColumn: bayIndex + 2,
                      gridRow: `${block.rowStart + 2} / span ${block.rowSpan}`,
                    }}
                    className={`pointer-events-none z-[5] m-0.5 flex flex-col justify-center overflow-hidden rounded-lg border px-2 py-1 text-white shadow-sm transition-shadow ${
                      isJustBooked
                        ? "border-[var(--teal)] bg-[var(--teal)] shadow-[0_0_0_4px_rgba(13,148,136,0.25)]"
                        : "border-[var(--teal-deep)]/30 bg-[var(--teal-deep)]"
                    }`}
                  >
                    <p className="truncate text-xs font-semibold">{block.label}</p>
                    {block.sublabel && (
                      <p className="truncate text-[10px] text-white/80">{block.sublabel}</p>
                    )}
                  </motion.div>
                );
              }),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
