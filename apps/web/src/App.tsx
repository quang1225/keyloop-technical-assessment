import { useCallback, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { SignInScreen } from "@/components/SignInScreen";
import { SchedulerShell } from "@/components/SchedulerShell";
import { BookingPanel } from "@/components/BookingPanel";
import type { BookingDraft } from "@/components/BookingPanel";
import { DayBoard } from "@/components/DayBoard";
import type { SelectedSlot } from "@/components/DayBoard";
import { DayAgenda } from "@/components/DayAgenda";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ConflictToast } from "@/components/ConflictToast";
import { SuccessToast } from "@/components/SuccessToast";
import { CommandPalette } from "@/components/CommandPalette";
import type { CommandAction } from "@/components/CommandPalette";
import { DEMO_DATE, formatSlotLabel, nextFreeSlot } from "@/lib/slots";
import { loadAdvisor, saveAdvisor, clearAdvisor } from "@/lib/auth";
import type { Advisor } from "@/lib/api";
import { useCatalog } from "@/hooks/useCatalog";
import { useSchedule } from "@/hooks/useSchedule";
import { useAvailability } from "@/hooks/useAvailability";

const queryClient = new QueryClient();

function App() {
  const [advisor, setAdvisor] = useState<Advisor | null>(() => loadAdvisor());

  return (
    <QueryClientProvider client={queryClient}>
      {!advisor ? (
        <SignInScreen
          onSuccess={(a) => {
            saveAdvisor(a);
            setAdvisor(a);
          }}
        />
      ) : (
        <AuthenticatedApp
          advisor={advisor}
          onSignOut={() => {
            clearAdvisor();
            setAdvisor(null);
          }}
        />
      )}
    </QueryClientProvider>
  );
}

function AuthenticatedApp({
  advisor,
  onSignOut,
}: {
  advisor: Advisor;
  onSignOut: () => void;
}) {
  const [date, setDate] = useState(DEMO_DATE);
  const { items } = useSchedule(advisor.advisor_id, date);

  return (
    <SchedulerShell
      advisor={advisor}
      onSignOut={onSignOut}
      appointmentCount={items.length}
    >
      <SchedulerPage advisorId={advisor.advisor_id} date={date} onDateChange={setDate} />
    </SchedulerShell>
  );
}

function SchedulerPage({
  advisorId,
  date,
  onDateChange,
}: {
  advisorId: string;
  date: string;
  onDateChange: (date: string) => void;
}) {
  const [draft, setDraft] = useState<BookingDraft>({
    vehicleId: null,
    serviceTypeId: null,
    date,
  });
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [justBookedId, setJustBookedId] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [showAgenda, setShowAgenda] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [prefillVehicleId, setPrefillVehicleId] = useState<string | null>(null);
  const { vehicles, serviceTypes, bays } = useCatalog(advisorId);
  const { items: scheduleItems } = useSchedule(advisorId, date);
  const { freeSlots } = useAvailability(advisorId, {
    vehicleId: draft.vehicleId,
    serviceTypeId: draft.serviceTypeId,
    date: draft.date,
  });
  const selectedBay = bays.find((bay) => bay.id === selectedSlot?.bayId) ?? null;
  const selectedVehicle = vehicles.find((v) => v.id === draft.vehicleId) ?? null;
  const selectedServiceType = serviceTypes.find((s) => s.id === draft.serviceTypeId) ?? null;

  const handleDraftChange = useCallback((next: BookingDraft) => {
    setDraft(next);
    setSelectedSlot(null);
  }, []);

  const handleDateChange = useCallback(
    (next: string) => {
      onDateChange(next);
      setSelectedSlot(null);
    },
    [onDateChange],
  );

  const findFreeBay = useCallback(
    (start: string) => {
      const startMs = new Date(start).getTime();
      const durationMs = (selectedServiceType?.duration_minutes ?? 30) * 60_000;
      const endMs = startMs + durationMs;
      for (const bay of bays) {
        const conflict = scheduleItems.some((item) => {
          if (item.bay_id !== bay.id) return false;
          const s = new Date(item.starts_at).getTime();
          const e = new Date(item.ends_at).getTime();
          return s < endMs && e > startMs;
        });
        if (!conflict) return bay.id;
      }
      return bays[0]?.id ?? null;
    },
    [bays, scheduleItems, selectedServiceType],
  );

  const selectFreeStart = useCallback(
    (start: string) => {
      const bayId = findFreeBay(start);
      if (!bayId) return;
      setSelectedSlot({ start, bayId });
    },
    [findFreeBay],
  );

  const jumpToFirstFree = useCallback(() => {
    if (freeSlots.length === 0) return;
    selectFreeStart(freeSlots[0]);
  }, [freeSlots, selectFreeStart]);

  useEffect(() => {
    setDraft((d) => (d.date === date ? d : { ...d, date }));
  }, [date]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((open) => !open);
        return;
      }

      if (typing || confirmOpen || commandOpen || inspectId) return;

      if (e.key === "Enter" && selectedSlot) {
        setConfirmOpen(true);
        return;
      }

      if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && draft.vehicleId && draft.serviceTypeId) {
        e.preventDefault();
        const delta = e.key === "ArrowRight" ? 1 : -1;
        const next = nextFreeSlot(selectedSlot?.start ?? null, freeSlots, delta);
        if (next) selectFreeStart(next);
      }

      if (e.key.toLowerCase() === "a" && !e.metaKey && !e.ctrlKey) {
        setShowAgenda((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedSlot,
    confirmOpen,
    commandOpen,
    inspectId,
    draft.vehicleId,
    draft.serviceTypeId,
    freeSlots,
    selectFreeStart,
  ]);

  function handleCommand(action: CommandAction) {
    if (action.type === "select-vehicle") {
      setPrefillVehicleId(action.vehicle.id);
      window.setTimeout(() => setPrefillVehicleId(null), 0);
      return;
    }
    if (action.type === "jump-first-free") {
      jumpToFirstFree();
      return;
    }
    if (action.type === "open-agenda") {
      setShowAgenda(true);
      return;
    }
    if (action.type === "today") {
      handleDateChange(DEMO_DATE);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex min-h-0 flex-1 flex-col gap-2 xl:flex-row">
        <div className="flex min-h-0 w-full shrink-0 flex-col gap-2 lg:flex-row xl:w-[300px] xl:flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:max-w-[320px] xl:max-w-none">
            <BookingPanel
              advisorId={advisorId}
              date={date}
              onDateChange={handleDateChange}
              onDraftChange={handleDraftChange}
              onPickSlot={selectFreeStart}
              prefillVehicleId={prefillVehicleId}
            />
          </div>
          {showAgenda && (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:max-w-[320px] xl:max-h-[42%] xl:max-w-none">
              <DayAgenda
                advisorId={advisorId}
                date={date}
                onInspect={setInspectId}
                highlightId={inspectId}
              />
            </div>
          )}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DayBoard
            advisorId={advisorId}
            draft={draft}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            onDateChange={handleDateChange}
            justBookedId={justBookedId}
            inspectId={inspectId}
            onInspectIdChange={setInspectId}
            onCancelled={() =>
              setSuccessMsg("Appointment cancelled — bay and technician freed")
            }
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 shadow-sm">
        <p className="text-sm text-[var(--ink)]">
          {selectedSlot ? (
            <>
              Selected: <span className="font-semibold">{formatSlotLabel(selectedSlot.start)}</span>
              {" · "}
              <span className="text-[var(--muted)]">{selectedBay?.name ?? "Bay"}</span>
              {selectedServiceType && (
                <>
                  {" · "}
                  <span className="text-[var(--muted)]">
                    {selectedServiceType.duration_minutes} min
                  </span>
                </>
              )}
            </>
          ) : draft.vehicleId && draft.serviceTypeId ? (
            <span className="text-[var(--muted)]">
              {freeSlots.length} free slot{freeSlots.length === 1 ? "" : "s"} — pick one on the
              board
              <kbd className="ml-2 hidden rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] sm:inline">
                ← →
              </kbd>
              <kbd className="ml-1 hidden rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] sm:inline">
                Enter
              </kbd>
            </span>
          ) : (
            <span className="text-[var(--muted)]">
              Pick a vehicle &amp; service, then a free slot.
              <kbd className="ml-2 hidden rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] sm:inline">
                ⌘K
              </kbd>
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAgenda((v) => !v)}
            className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:border-[var(--teal)] hover:text-[var(--teal)]"
          >
            {showAgenda ? "Hide agenda" : "Show agenda"}
          </button>
          <button
            type="button"
            disabled={!selectedSlot}
            onClick={() => setConfirmOpen(true)}
            className="rounded-md bg-[var(--teal)] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--teal-deep)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm booking
          </button>
        </div>
      </div>

      <AnimatePresence>
        {confirmOpen && selectedSlot && selectedVehicle && selectedServiceType && (
          <ConfirmDialog
            key="confirm-dialog"
            advisorId={advisorId}
            date={draft.date}
            vehicle={selectedVehicle}
            serviceType={selectedServiceType}
            bay={selectedBay}
            start={selectedSlot.start}
            onClose={() => setConfirmOpen(false)}
            onConfirmed={(appointment) => {
              setConfirmOpen(false);
              setSelectedSlot(null);
              setJustBookedId(appointment.id);
              setSuccessMsg(
                `${selectedVehicle.make} ${selectedVehicle.model} · ${formatSlotLabel(appointment.starts_at)}`,
              );
              window.setTimeout(() => setJustBookedId(null), 1400);
            }}
            onConflict={() => {
              setSelectedSlot(null);
              setShowConflict(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConflict && (
          <ConflictToast key="conflict-toast" onDismiss={() => setShowConflict(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {successMsg && (
          <SuccessToast
            key="success-toast"
            message={
              successMsg.startsWith("Appointment cancelled")
                ? "Appointment cancelled"
                : "Appointment booked"
            }
            detail={
              successMsg.startsWith("Appointment cancelled")
                ? "Bay and technician freed for rebooking"
                : successMsg
            }
            onDismiss={() => setSuccessMsg(null)}
          />
        )}
      </AnimatePresence>

      <CommandPalette
        open={commandOpen}
        advisorId={advisorId}
        onClose={() => setCommandOpen(false)}
        onAction={handleCommand}
        hasFreeSlots={freeSlots.length > 0}
      />
    </div>
  );
}

export default App;
