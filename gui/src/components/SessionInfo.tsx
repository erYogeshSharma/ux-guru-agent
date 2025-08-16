import React from "react";
import { Box, Typography, Button, Chip, Stack } from "@mui/material";
import {
  ExitToApp,
  Person,
  Language,
  Schedule,
  Error as ErrorIcon,
} from "@mui/icons-material";
import Tooltip from "@mui/material/Tooltip";
import Grid from "@mui/material/Grid";
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
        p: 2, // unchanged padding per request
        width: "100%",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      {/* Reduced vertical spacing to make compact */}
      <Stack spacing={1}>
        {/* Header Row */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle1" sx={{ lineHeight: 1 }}>
              Session: {sessionId?.slice(-8)}
            </Typography>
            {isLive && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
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
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  sx={{ lineHeight: 1 }}
                >
                  LIVE
                </Typography>
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {eventCount} events
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<ExitToApp />}
            onClick={onLeaveSession}
            color="error"
            size="small"
          >
            Leave
          </Button>
        </Box>

        {/* Session Details - compact grid layout */}
        {sessionData && (
          <Grid container spacing={1} alignItems="center">
            {/* Left column: user, url */}
            <Grid item xs={12} sm={6}>
              <Box display="flex" alignItems="center" gap={1}>
                <Person sx={{ fontSize: 16, color: "text.secondary" }} />
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, lineHeight: 1 }}
                >
                  {sessionData.userId || "Unknown"}
                </Typography>
                {sessionData.metadata.url && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      ml: 1,
                      maxWidth: 220,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sessionData.metadata.url}
                  </Typography>
                )}
              </Box>
            </Grid>

            {/* Right column: duration + errors as compact chips */}
            <Grid item xs={12} sm={6}>
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                {sessionData.metadata.startTime &&
                  sessionData.metadata.lastActivity && (
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<Schedule sx={{ fontSize: 14 }} />}
                      label={formatDuration(
                        sessionData.metadata.startTime,
                        sessionData.metadata.lastActivity
                      )}
                    />
                  )}
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<Person sx={{ fontSize: 14 }} />}
                  label={sessionData.userId || "user"}
                />
                {sessionData.errorCount > 0 && (
                  <Chip
                    size="small"
                    color="error"
                    icon={<ErrorIcon sx={{ fontSize: 14 }} />}
                    label={`${sessionData.errorCount} errors`}
                  />
                )}
              </Box>
            </Grid>

            {/* Additional metadata row - user agent / viewport / timezone / referrer as chips/tooltips */}
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                {sessionData.metadata.userAgent && (
                  <Tooltip
                    title={sessionData.metadata.userAgent}
                    placement="top"
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      label="User Agent"
                      sx={{
                        maxWidth: 240,
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                    />
                  </Tooltip>
                )}
                <Tooltip
                  title={`Viewport: ${sessionData.metadata.viewport.width}×${sessionData.metadata.viewport.height} @${sessionData.metadata.viewport.devicePixelRatio}x`}
                >
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${sessionData.metadata.viewport.width}×${sessionData.metadata.viewport.height}`}
                  />
                </Tooltip>
                {sessionData.metadata.timeZone && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={sessionData.metadata.timeZone}
                  />
                )}
                {sessionData.metadata.referrer && (
                  <Tooltip
                    title={sessionData.metadata.referrer}
                    placement="top"
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      label="Referrer"
                      sx={{
                        maxWidth: 200,
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                    />
                  </Tooltip>
                )}
              </Box>
            </Grid>
          </Grid>
        )}

        {/* Timing Info - single compact row */}
        {sessionData && (
          <Stack direction="row" spacing={1}>
            <Typography variant="caption" color="text.secondary">
              Started: {formatTime(sessionData.metadata.startTime)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              •
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last: {formatTime(sessionData.metadata.lastActivity)}
            </Typography>
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default SessionInfo;
