import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export type Customer = {
  id: string;
  full_name: string;
  email: string;
};

export type Vehicle = {
  id: string;
  vin: string;
  make: string;
  model: string;
  customer: Customer;
};

export type ServiceType = {
  id: string;
  name: string;
  duration_minutes: number;
  required_skills: string[];
};

export type Bay = {
  id: string;
  name: string;
};

export type Technician = {
  id: string;
  full_name: string;
  skills: string[];
};

export function useCatalog(advisorId: string) {
  const vehicles = useQuery({
    queryKey: ["catalog", "vehicles", advisorId],
    queryFn: () => apiGet<Vehicle[]>("/catalog/vehicles", advisorId),
  });

  const serviceTypes = useQuery({
    queryKey: ["catalog", "service-types", advisorId],
    queryFn: () => apiGet<ServiceType[]>("/catalog/service-types", advisorId),
  });

  const bays = useQuery({
    queryKey: ["catalog", "bays", advisorId],
    queryFn: () => apiGet<Bay[]>("/catalog/bays", advisorId),
  });

  const technicians = useQuery({
    queryKey: ["catalog", "technicians", advisorId],
    queryFn: () => apiGet<Technician[]>("/catalog/technicians", advisorId),
  });

  return {
    vehicles: vehicles.data ?? [],
    serviceTypes: serviceTypes.data ?? [],
    bays: bays.data ?? [],
    technicians: technicians.data ?? [],
    isLoading:
      vehicles.isLoading || serviceTypes.isLoading || bays.isLoading || technicians.isLoading,
    isError: vehicles.isError || serviceTypes.isError || bays.isError || technicians.isError,
  };
}
