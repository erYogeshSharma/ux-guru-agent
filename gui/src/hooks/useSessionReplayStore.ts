import { useStore } from "@tanstack/react-store";
import { useMemo } from "react";
import {
  sessionReplayStore,
  sessionReplayActions,
} from "../store/sessionReplayStore";

export const useSessionReplayStore = () => {
  // Subscribe to specific parts of the store
  const activeSessions = useStore(
    sessionReplayStore,
    (state) => state.activeSessions
  );
  const selectedSession = useStore(
    sessionReplayStore,
    (state) => state.selectedSession
  );
  const sessionEvents = useStore(
    sessionReplayStore,
    (state) => state.sessionEvents
  );
  const playerState = useStore(
    sessionReplayStore,
    (state) => state.playerState
  );
  const playerInstance = useStore(
    sessionReplayStore,
    (state) => state.playerInstance
  );
  const isLive = useStore(sessionReplayStore, (state) => state.isLive);
  const loading = useStore(sessionReplayStore, (state) => state.loading);
  const error = useStore(sessionReplayStore, (state) => state.error);
  const readyState = useStore(sessionReplayStore, (state) => state.readyState);
  const showServerStats = useStore(
    sessionReplayStore,
    (state) => state.showServerStats
  );
  const serverStats = useStore(
    sessionReplayStore,
    (state) => state.serverStats
  );

  // Computed values
  const isConnected = readyState === WebSocket.OPEN;
  const hasSelectedSession = selectedSession !== null;
  const canPlay = sessionEvents.length > 0 && !loading;
  const eventCount = sessionEvents.length;

  // Memoize actions to prevent unnecessary re-renders
  const actions = useMemo(() => sessionReplayActions, []);

  return {
    // State
    activeSessions,
    selectedSession,
    sessionEvents,
    playerState,
    playerInstance,
    isLive,
    loading,
    error,
    readyState,
    showServerStats,
    serverStats,

    // Computed
    isConnected,
    hasSelectedSession,
    canPlay,
    eventCount,

    // Actions
    actions,
  };
};
