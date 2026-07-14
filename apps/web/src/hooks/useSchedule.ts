import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export type ScheduleItem = {
  id: string;
  vehicle_id: string;
  service_type_id: string;
  bay_id: string;
  technician_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

export function useSchedule(advisorId: string, date: string) {
  const query = useQuery({
    queryKey: ["schedule", advisorId, date],
    queryFn: () => apiGet<ScheduleItem[]>("/schedule", advisorId, { date }),
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
