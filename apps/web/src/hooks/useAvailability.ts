import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

type AvailabilityResponse = {
  slots: string[];
};

type Params = {
  vehicleId: string | null;
  serviceTypeId: string | null;
  date: string | null;
};

export function useAvailability(advisorId: string, { vehicleId, serviceTypeId, date }: Params) {
  const enabled = Boolean(vehicleId && serviceTypeId && date);

  const query = useQuery({
    queryKey: ["availability", advisorId, vehicleId, serviceTypeId, date],
    queryFn: () =>
      apiGet<AvailabilityResponse>("/availability", advisorId, {
        vehicle_id: vehicleId!,
        service_type_id: serviceTypeId!,
        date: date!,
      }),
    enabled,
  });

  return {
    freeSlots: query.data?.slots ?? [],
    isLoading: enabled && query.isLoading,
    isError: query.isError,
  };
}
