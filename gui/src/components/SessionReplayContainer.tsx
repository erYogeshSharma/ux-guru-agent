import React, { useEffect } from "react";
import { Box, Stack } from "@mui/material";
import {
  SessionHistoryList,
  WelcomeScreen,
  SessionInfo,
  LoadingOverlay,
  ServerStats,
} from "./index";
import CustomPlayer from "./CustomPlayer";
import { useSessionReplayWebSocket } from "../hooks/useSessionReplayWebSocket";
import { useSessionReplayStore } from "../hooks/useSessionReplayStore";
import type { Session, eventWithTime } from "../types";

interface SessionReplayContainerProps {
  wsUrl: string;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
}

export const SessionReplayContainer: React.FC<SessionReplayContainerProps> = ({
  wsUrl,
  autoReconnect,
  maxReconnectAttempts,
}) => {
  const {
    activeSessions,
    selectedSession,
    sessionEvents,
    isLive,
    loading,
    showServerStats,
    actions,
  } = useSessionReplayStore();

  // WebSocket handlers
  const handleSessionsUpdate = (sessions: Session[]) => {
    actions.updateSessions(sessions);
  };

  const handleSessionStarted = (session: Partial<Session>) => {
    if (session.sessionId) {
      // Convert the session to match our store structure
      const storeSession: Session = {
        sessionId: session.sessionId,
        userId: session.userId || "Unknown",
        metadata: session.metadata || {
          url: "",
          userAgent: "",
          viewport: { width: 0, height: 0, devicePixelRatio: 1 },
          startTime: Date.now(),
          lastActivity: Date.now(),
          referrer: "",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        eventCount: session.eventCount || 0,
        errorCount: session.errorCount || 0,
      };
      actions.addSession(storeSession);
    }
  };

  const handleSessionEnded = (sessionId: string) => {
    actions.removeSession(sessionId);
  };

  const handleSessionJoined = (
    sessionId: string,
    events: eventWithTime[],
    isActive: boolean
  ) => {
    if (sessionId === selectedSession) {
      actions.setSessionEvents(events);
      actions.setIsLive(isActive);
      actions.setLoading(false);
    }
  };

  const handleEventsBatch = (sessionId: string, events: eventWithTime[]) => {
    if (sessionId === selectedSession && isLive) {
      actions.addSessionEvents(events);
    }
  };

  const handleError = (message: string | null) => {
    actions.setError(message);
  };

  // WebSocket hook
  const {
    readyState,
    joinSession: wsJoinSession,
    leaveSession: wsLeaveSession,
  } = useSessionReplayWebSocket({
    wsUrl,
    autoReconnect,
    maxReconnectAttempts,
    onSessionsUpdate: handleSessionsUpdate,
    onSessionStarted: handleSessionStarted,
    onSessionEnded: handleSessionEnded,
    onSessionJoined: handleSessionJoined,
    onEventsBatch: handleEventsBatch,
    onError: handleError,
  });

  // Update store with connection state
  useEffect(() => {
    actions.setReadyState(readyState);
  }, [readyState, actions]);

  // Session management
  const joinSession = (sessionId: string) => {
    if (selectedSession === sessionId) return;

    actions.setSelectedSession(sessionId);
    actions.setIsLive(true);
    actions.setSessionEvents([]);
    actions.setLoading(true);
    actions.setError(null);

    wsJoinSession(sessionId);
  };

  const leaveSession = () => {
    if (selectedSession) {
      wsLeaveSession(selectedSession);
    }

    actions.setSelectedSession(null);
    actions.setIsLive(false);
    actions.setSessionEvents([]);
    actions.setLoading(false);
  };

  // Utility functions
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (startTime: number, lastActivity: number) => {
    const duration = Math.floor((lastActivity - startTime) / 1000);
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const selectedSessionData = activeSessions.find(
    (s) => s.sessionId === selectedSession
  );

  return (
    <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Session List Sidebar */}
      <SessionHistoryList
        selectedSessionId={selectedSession}
        onSessionSelect={joinSession}
        formatTime={formatTime}
        formatDuration={formatDuration}
      />

      {/* Main Content Area */}
      <Stack sx={{ flex: 1, overflow: "hidden" }} spacing={2}>
        {/* Server Stats */}
        {showServerStats && (
          <Box sx={{ p: 2 }}>
            <ServerStats />
          </Box>
        )}

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {selectedSession ? (
            <Stack sx={{ flex: 1, overflow: "hidden" }} spacing={2}>
              {/* Session Info */}
              {selectedSessionData && (
                <SessionInfo
                  sessionId={selectedSession}
                  isLive={isLive}
                  eventCount={sessionEvents.length}
                  onLeaveSession={leaveSession}
                />
              )}

              {/* Loading Overlay */}
              <LoadingOverlay open={loading} />

              {/* Custom Player */}
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  p: 2,
                }}
              >
                <CustomPlayer
                  events={sessionEvents}
                  width={1024}
                  height={576}
                  showController={false} // Use our custom MUI controls
                  autoPlay={isLive}
                />
              </Box>
            </Stack>
          ) : (
            /* Welcome Screen */
            <WelcomeScreen />
          )}
        </Box>
      </Stack>
    </Box>
  );
};
