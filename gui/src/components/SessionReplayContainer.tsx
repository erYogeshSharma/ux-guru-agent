import React from "react";
import { Box, Stack } from "@mui/material";
import {
  SessionHistoryList,
  WelcomeScreen,
  SessionInfo,
  LoadingOverlay,
  ServerStats,
} from "./index";
import CustomPlayer from "./CustomPlayer";
import { useSessionManager } from "@/hooks/useSessionManager";
import { useSessionReplayStore } from "@/hooks/useSessionReplayStore";
import type { Session } from "@/types";

interface SessionReplayContainerProps {
  wsUrl: string;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
}

export const SessionReplayContainer: React.FC<
  SessionReplayContainerProps
> = () => {
  const {
    activeSessions,
    selectedSession,
    sessionEvents,
    isLoading,
    joinLiveSession,
    joinHistoricalSession,
    leaveSession: managerLeaveSession,
    getSessionStatus,
  } = useSessionManager();

  const { isLive, loading, showServerStats } = useSessionReplayStore();

  // Session management functions
  const handleSessionSelect = async (
    sessionId: string,
    sessionData?: Session
  ) => {
    if (selectedSession === sessionId) return;

    try {
      if (sessionData) {
        // Historical session from the list
        const sessionStatus = getSessionStatus(sessionId);
        if (sessionStatus.isLive) {
          await joinLiveSession(sessionId);
        } else {
          await joinHistoricalSession(sessionId);
        }
      } else {
        // Live session
        await joinLiveSession(sessionId);
      }
    } catch (error) {
      console.error("Failed to join session:", error);
    }
  };

  const handleLeaveSession = () => {
    managerLeaveSession();
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
        onSessionSelect={handleSessionSelect}
        wsActiveSessions={activeSessions}
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
                onLeaveSession={handleLeaveSession}
                sessionData={selectedSessionData}
              />

              {/* Loading Overlay */}
              <LoadingOverlay open={loading || isLoading} />

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
