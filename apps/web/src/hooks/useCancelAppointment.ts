import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import type { ScheduleItem } from "@/hooks/useSchedule";

export function useCancelAppointment(advisorId: string, date: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (appointmentId: string) =>
      apiPost<ScheduleItem>(`/appointments/${appointmentId}/cancel`, advisorId, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", advisorId, date] });
      queryClient.invalidateQueries({ queryKey: ["availability", advisorId] });
    },
  });

  return {
    cancelAppointment: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
