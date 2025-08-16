/**
 * TanStack Query hooks for Session Replay Server API
 * Provides React hooks for server state management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

// Query keys for cache management
export const queryKeys = {
  health: ["health"] as const,
  stats: ["stats"] as const,
  sessions: {
    all: ["sessions"] as const,
    active: ["sessions", "active"] as const,
    history: (limit: number, offset: number) =>
      ["sessions", "history", limit, offset] as const,
    events: (sessionId: string) => ["sessions", sessionId, "events"] as const,
  },
} as const;

// Health check query
export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

// Server stats query
export function useStatsQuery() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => apiClient.getStats(),
    refetchInterval: 50000, // Refetch every 5 seconds for live stats
    staleTime: 2000, // Consider data stale after 2 seconds
  });
}

// Active sessions query
export function useActiveSessionsQuery() {
  return useQuery({
    queryKey: queryKeys.sessions.active,
    queryFn: async () => {
      const result = await apiClient.getActiveSessions();
      return result.sessions;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 1000, // Consider data stale after 1 second
  });
}

// Session history query
export function useSessionHistoryQuery(
  limit: number = 100,
  offset: number = 0,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.sessions.history(limit, offset),
    queryFn: async () => {
      const result = await apiClient.getSessionHistory(limit, offset);
      return result;
    },
    enabled,
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}

// Session events query
export function useSessionEventsQuery(
  sessionId: string | null,
  fromIndex: number = 0,
  limit: number = 1000,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.sessions.events(sessionId || ""),
    queryFn: () => {
      if (!sessionId) throw new Error("Session ID is required");
      return apiClient.getSessionEvents(sessionId, fromIndex, limit);
    },
    enabled: enabled && !!sessionId,
    staleTime: 0, // Always consider stale for real-time data
    refetchInterval: 2000, // Refetch every 2 seconds when watching
  });
}

// Cleanup old sessions mutation
export function useCleanupSessionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (maxAgeHours: number = 24) =>
      apiClient.cleanupOldSessions(maxAgeHours),
    onSuccess: () => {
      // Invalidate and refetch sessions after cleanup
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

// Helper hook to get all API data at once
export function useApiOverview() {
  const health = useHealthQuery();
  const stats = useStatsQuery();
  const sessions = useActiveSessionsQuery();

  return {
    health,
    stats,
    sessions,
    isLoading: health.isLoading || stats.isLoading || sessions.isLoading,
    isError: health.isError || stats.isError || sessions.isError,
    errors: [health.error, stats.error, sessions.error].filter(Boolean),
  };
}
