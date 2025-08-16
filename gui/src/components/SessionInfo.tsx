import React from "react";
import { Box, Typography, Button, Chip, Stack } from "@mui/material";
import {
  ExitToApp,
  Person,
  Language,
  Schedule,
  Error as ErrorIcon,
} from "@mui/icons-material";
import type { Session } from "../types";

// Legacy SessionControls component - replaced by rrweb-player built-in controls
interface SessionInfoProps {
  sessionId: string | null;
  isLive: boolean;
  eventCount: number;
  onLeaveSession: () => void;
  sessionData?: Session;
}

const SessionInfo: React.FC<SessionInfoProps> = ({
  sessionId,
  isLive,
  eventCount,
  onLeaveSession,
  sessionData,
}) => {
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

  return (
    <Box
      sx={{
        p: 2,
        width: "100%",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Stack spacing={2}>
        {/* Header Row */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="h6">
              Session: {sessionId?.slice(-8)}
            </Typography>
            {isLive && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  color: "success.main",
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: "success.main",
                    animation: "pulse 2s infinite",
                    "@keyframes pulse": {
                      "0%": { opacity: 1 },
                      "50%": { opacity: 0.5 },
                      "100%": { opacity: 1 },
                    },
                  }}
                />
                <Typography variant="body2" fontWeight="bold">
                  LIVE
                </Typography>
              </Box>
            )}
            <Typography variant="body2" color="text.secondary">
              {eventCount} events
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<ExitToApp />}
            onClick={onLeaveSession}
            color="error"
          >
            Leave Session
          </Button>
        </Box>

        {/* Session Details */}
        {sessionData && (
          <Stack direction="row" spacing={4} alignItems="center">
            {/* User Info */}
            <Box display="flex" alignItems="center" gap={1}>
              <Person sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="body2">
                <strong>User:</strong> {sessionData.userId || "Unknown"}
              </Typography>
            </Box>

            {/* URL */}
            {sessionData.metadata.url && (
              <Box display="flex" alignItems="center" gap={1}>
                <Language sx={{ fontSize: 16, color: "text.secondary" }} />
                <Typography
                  variant="body2"
                  sx={{
                    maxWidth: 300,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <strong>URL:</strong> {sessionData.metadata.url}
                </Typography>
              </Box>
            )}

            {/* Duration */}
            {sessionData.metadata.startTime &&
              sessionData.metadata.lastActivity && (
                <Box display="flex" alignItems="center" gap={1}>
                  <Schedule sx={{ fontSize: 16, color: "text.secondary" }} />
                  <Typography variant="body2">
                    <strong>Duration:</strong>{" "}
                    {formatDuration(
                      sessionData.metadata.startTime,
                      sessionData.metadata.lastActivity
                    )}
                  </Typography>
                </Box>
              )}

            {/* Error Count */}
            {sessionData.errorCount > 0 && (
              <Chip
                size="small"
                color="error"
                icon={<ErrorIcon sx={{ fontSize: 14 }} />}
                label={`${sessionData.errorCount} errors`}
              />
            )}
          </Stack>
        )}

        {/* Timing Info */}
        {sessionData && (
          <Stack direction="row" spacing={4}>
            <Typography variant="caption" color="text.secondary">
              Started: {formatTime(sessionData.metadata.startTime)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last Activity: {formatTime(sessionData.metadata.lastActivity)}
            </Typography>
            {sessionData.metadata.timeZone && (
              <Typography variant="caption" color="text.secondary">
                Timezone: {sessionData.metadata.timeZone}
              </Typography>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default SessionInfo;
