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
import { useSessionReplayWebSocket } from "../hooks";
import { useSessionReplayStore } from "../hooks/useSessionReplayStore";
import { sessionReplayStore } from "../store/sessionReplayStore";
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
    // Read current selected session from the store directly to avoid
    // closure staleness when websocket messages arrive before React
    // effects have updated local component variables.
    const currentSelected = sessionReplayStore.state.selectedSession;
    if (sessionId === currentSelected) {
      actions.setSessionEvents(events);
      actions.setIsLive(isActive);
      actions.setLoading(false);
    }
  };

  const handleEventsBatch = (sessionId: string, events: eventWithTime[]) => {
    const currentSelected = sessionReplayStore.state.selectedSession;
    const currentIsLive = sessionReplayStore.state.isLive;
    if (sessionId === currentSelected && currentIsLive) {
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
  const joinSession = (sessionId: string, sessionData?: Session) => {
    if (selectedSession === sessionId) return;

    // If we have session data (from history), add it to the store
    if (sessionData) {
      actions.addSession(sessionData);
    }

    actions.setSelectedSession(sessionId);
    actions.setIsLive(true);
    actions.setSessionEvents([]);
    actions.setLoading(true);
    actions.setError(null);

    wsJoinSession(sessionId);
  };
  const joinSessionFromHistory = (sessionData: Session) => {
    if (selectedSession === sessionData.sessionId) return;

    // Leave current session first
    if (selectedSession) {
      wsLeaveSession(selectedSession);
    }

    // Add session to store if not already there
    const existingSession = activeSessions.find(
      (s) => s.sessionId === sessionData.sessionId
    );
    if (!existingSession) {
      actions.addSession(sessionData);
    }

    // Clear current state
    actions.setSessionEvents([]);
    actions.setError(null);

    // Set new session
    actions.setSelectedSession(sessionData.sessionId);
    actions.setIsLive(false); // History sessions are not live initially
    actions.setLoading(true);

    // Join session
    wsJoinSession(sessionData.sessionId);
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

  const selectedSessionData =
    activeSessions.find((s) => s.sessionId === selectedSession) || undefined;

  // Debug logging can be enabled here if needed
  // console.log("SessionReplayContainer - selectedSession:", selectedSession);
  // console.log("SessionReplayContainer - selectedSessionData:", selectedSessionData);

  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        overflow: "hidden",
      }}
    >
      {/* Session List Sidebar */}
      <SessionHistoryList
        selectedSessionId={selectedSession}
        onSessionSelect={(sessionId, sessionData) => {
          if (sessionData) {
            joinSessionFromHistory(sessionData);
          } else {
            joinSession(sessionId);
          }
        }}
        formatTime={formatTime}
        formatDuration={formatDuration}
      />

      {/* Main Content Area */}
      <Stack sx={{ flex: 1, height: "100%", overflow: "hidden" }} spacing={2}>
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
              <SessionInfo
                sessionId={selectedSession}
                isLive={isLive}
                eventCount={sessionEvents.length}
                onLeaveSession={leaveSession}
                sessionData={selectedSessionData}
              />

              {/* Loading Overlay */}
              <LoadingOverlay open={loading} />

              {/* Custom Player */}
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0, // Important for flex child to shrink
                  overflow: "hidden",
                  width: "100%",
                }}
              >
                <CustomPlayer
                  key={selectedSession} // Force remount when session changes
                  events={sessionEvents}
                  width={600}
                  height={400}
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
