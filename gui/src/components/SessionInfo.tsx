import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { ExitToApp } from "@mui/icons-material";

// Legacy SessionControls component - replaced by rrweb-player built-in controls
interface SessionInfoProps {
  sessionId: string | null;
  isLive: boolean;
  eventCount: number;
  onLeaveSession: () => void;
}

const SessionInfo: React.FC<SessionInfoProps> = ({
  sessionId,
  isLive,
  eventCount,
  onLeaveSession,
}) => {
  return (
    <Box
      sx={{
        p: 2,
        width: "100%",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h6">Session: {sessionId?.slice(-8)}</Typography>
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
    </Box>
  );
};

export default SessionInfo;
