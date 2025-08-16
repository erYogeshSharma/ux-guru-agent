/**
 * API module exports
 * Central export point for API client and query hooks
 */

export {
  apiClient,
  type ApiSession,
  type ApiSessionEvent,
  type ServerStats,
  type HealthResponse,
} from "./client";
export {
  queryKeys,
  useHealthQuery,
  useStatsQuery,
  useActiveSessionsQuery,
  useSessionHistoryQuery,
  useSessionEventsQuery,
  useCleanupSessionsMutation,
  useApiOverview,
} from "./queries";
