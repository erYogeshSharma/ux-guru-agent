/**
 * Hook for using the centralized SessionManager
 */

import { useEffect, useMemo } from "react";
import { useSessionReplayStore } from "./useSessionReplayStore";
import { sessionManager } from "../services/SessionManager";
import type { Session, eventWithTime } from "../types";

export interface UseSessionManagerReturn {
  // Session data
  activeSessions: Session[];
  historySessions: Session[];
  selectedSession: string | null;
  sessionEvents: eventWithTime[];

  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Session actions
  joinLiveSession: (sessionId: string) => Promise<void>;
  joinHistoricalSession: (sessionId: string) => Promise<void>;
  leaveSession: () => void;
  refreshSessions: () => Promise<void>;

  // Session status
  getSessionStatus: (sessionId: string) => {
    isActive: boolean;
    isLive: boolean;
  };
}

export const useSessionManager = (): UseSessionManagerReturn => {
  const store = useSessionReplayStore();

  // Initialize session manager on mount
  useEffect(() => {
    let initialized = false;

    const initializeManager = async () => {
      if (!initialized) {
        initialized = true;
        try {
          await sessionManager.initialize();
        } catch (error) {
          console.error("Failed to initialize session manager:", error);
        }
      }
    };

    initializeManager();

    // Cleanup on unmount
    return () => {
      if (initialized) {
        sessionManager.destroy();
      }
    };
  }, []);

  // Memoized actions to prevent unnecessary re-renders
  const actions = useMemo(
    () => ({
      joinLiveSession: async (sessionId: string) => {
        await sessionManager.joinSession(sessionId, true);
      },

      joinHistoricalSession: async (sessionId: string) => {
        await sessionManager.joinSession(sessionId, false);
      },

      leaveSession: () => {
        sessionManager.leaveSession();
      },

      refreshSessions: async () => {
        await sessionManager.refreshActiveSessions();
      },

      getSessionStatus: (sessionId: string) => {
        return sessionManager.getSessionStatus(sessionId);
      },
    }),
    []
  );

  return {
    // Session data from store
    activeSessions: store.activeSessions,
    historySessions: store.historySessions,
    selectedSession: store.selectedSession,
    sessionEvents: store.sessionEvents,

    // Connection state
    isConnected: store.isConnected,
    isLoading: store.loading,
    error: store.error,

    // Actions
    ...actions,
  };
};
