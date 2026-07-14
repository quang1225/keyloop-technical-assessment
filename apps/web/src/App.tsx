import { useCallback, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { SignInScreen } from "@/components/SignInScreen";
import { SchedulerShell } from "@/components/SchedulerShell";
import { BookingPanel } from "@/components/BookingPanel";
import type { BookingDraft } from "@/components/BookingPanel";
import { DayBoard } from "@/components/DayBoard";
import type { SelectedSlot } from "@/components/DayBoard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ConflictToast } from "@/components/ConflictToast";
import { formatSlotLabel } from "@/lib/slots";
import { loadAdvisor, saveAdvisor, clearAdvisor } from "@/lib/auth";
import type { Advisor } from "@/lib/api";
import { useCatalog } from "@/hooks/useCatalog";

const queryClient = new QueryClient();
const DEFAULT_DATE = "2026-07-15";

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
        <SchedulerShell
          advisor={advisor}
          onSignOut={() => {
            clearAdvisor();
            setAdvisor(null);
          }}
        >
          <SchedulerPage advisorId={advisor.advisor_id} />
        </SchedulerShell>
      )}
    </QueryClientProvider>
  );
}

function SchedulerPage({ advisorId }: { advisorId: string }) {
  const [draft, setDraft] = useState<BookingDraft>({
    vehicleId: null,
    serviceTypeId: null,
    date: DEFAULT_DATE,
  });
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [justBookedId, setJustBookedId] = useState<string | null>(null);
  const { vehicles, serviceTypes, bays } = useCatalog(advisorId);
  const selectedBay = bays.find((bay) => bay.id === selectedSlot?.bayId) ?? null;
  const selectedVehicle = vehicles.find((v) => v.id === draft.vehicleId) ?? null;
  const selectedServiceType = serviceTypes.find((s) => s.id === draft.serviceTypeId) ?? null;

  const handleDraftChange = useCallback((next: BookingDraft) => {
    setDraft(next);
    setSelectedSlot(null);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full shrink-0 lg:w-[360px]">
          <BookingPanel advisorId={advisorId} defaultDate={DEFAULT_DATE} onDraftChange={handleDraftChange} />
        </div>
        <div className="min-w-0 flex-1">
          <DayBoard
            advisorId={advisorId}
            draft={draft}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            justBookedId={justBookedId}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 shadow-sm">
        <p className="text-sm text-[var(--ink)]">
          {selectedSlot ? (
            <>
              Selected: <span className="font-semibold">{formatSlotLabel(selectedSlot.start)}</span>
              {" · "}
              <span className="text-[var(--muted)]">{selectedBay?.name ?? "Bay"}</span>
            </>
          ) : (
            <span className="text-[var(--muted)]">Pick a free slot on the schedule to continue.</span>
          )}
        </p>
        <button
          type="button"
          disabled={!selectedSlot}
          onClick={() => setConfirmOpen(true)}
          className="rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--teal-deep)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm booking
        </button>
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
        {showConflict && <ConflictToast key="conflict-toast" onDismiss={() => setShowConflict(false)} />}
      </AnimatePresence>
    </div>
  );
}

export default App;
