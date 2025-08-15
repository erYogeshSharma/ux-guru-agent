import React from "react";
import { AppBar, Toolbar, Typography, Chip } from "@mui/material";
import { Visibility, FiberManualRecord } from "@mui/icons-material";
import { ReadyState } from "react-use-websocket";

interface ConnectionStatusProps {
  readyState: ReadyState;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ readyState }) => {
  const connectionStatus = React.useMemo(
    () =>
      ({
        [ReadyState.CONNECTING]: {
          text: "Connecting...",
          color: "warning" as const,
        },
        [ReadyState.OPEN]: { text: "Connected", color: "success" as const },
        [ReadyState.CLOSING]: { text: "Closing...", color: "warning" as const },
        [ReadyState.CLOSED]: { text: "Disconnected", color: "error" as const },
        [ReadyState.UNINSTANTIATED]: {
          text: "Uninstantiated",
          color: "default" as const,
        },
      }[readyState]),
    [readyState]
  );

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 1 }}
        >
          <Visibility />
          Live Session Replay
        </Typography>

        <Chip
          icon={<FiberManualRecord />}
          label={connectionStatus.text}
          color={connectionStatus.color}
          variant="outlined"
          sx={{ color: "white", borderColor: "rgba(255,255,255,0.3)" }}
        />
      </Toolbar>
    </AppBar>
  );
};

export default ConnectionStatus;
