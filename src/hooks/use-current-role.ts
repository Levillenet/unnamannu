import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCurrentRole } from "@/lib/users.functions";

export const currentRoleQueryOptions = queryOptions({
  queryKey: ["current-role"],
  queryFn: () => getCurrentRole(),
  staleTime: 60_000,
});

export function useCurrentRole() {
  const { data } = useSuspenseQuery(currentRoleQueryOptions);
  return data;
}

export function useIsAdmin() {
  return useCurrentRole().role === "admin";
}
