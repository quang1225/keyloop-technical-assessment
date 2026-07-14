import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import type { ScheduleItem } from "@/hooks/useSchedule";

export type CreateAppointmentInput = {
  vehicleId: string;
  serviceTypeId: string;
  start: string;
  bayId?: string | null;
};

function isConflictError(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { status?: number }).status === 409);
}

export function useCreateAppointment(advisorId: string, date: string) {
  const queryClient = useQueryClient();
  const [isConflict, setIsConflict] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: CreateAppointmentInput) =>
      apiPost<ScheduleItem>("/appointments", advisorId, {
        vehicle_id: input.vehicleId,
        service_type_id: input.serviceTypeId,
        start: input.start,
        bay_id: input.bayId ?? null,
      }),
    onSuccess: () => {
      setIsConflict(false);
      queryClient.invalidateQueries({ queryKey: ["schedule", advisorId, date] });
      queryClient.invalidateQueries({ queryKey: ["availability", advisorId] });
    },
    onError: (err) => {
      if (isConflictError(err)) {
        setIsConflict(true);
        queryClient.invalidateQueries({ queryKey: ["schedule", advisorId, date] });
        queryClient.invalidateQueries({ queryKey: ["availability", advisorId] });
      }
    },
  });

  const dismissConflict = useCallback(() => setIsConflict(false), []);

  return {
    createAppointment: mutation.mutateAsync,
    isPending: mutation.isPending,
    isConflict,
    dismissConflict,
    reset: mutation.reset,
  };
}
