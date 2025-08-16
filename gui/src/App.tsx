import React from "react";
import { Box } from "@mui/material";
import {
  ConnectionStatus,
  ErrorAlert,
  SessionReplayContainer,
} from "./components";
import { useSessionReplayStore } from "./hooks/useSessionReplayStore";

/**
 * Main App Component - Refactored with TanStack Store
 *
 * This component serves as the main entry point and orchestrates the session replay interface.
 * It uses the TanStack store for centralized state management instead of local component state.
 *
 * Key improvements:
 * - Centralized state management with TanStack Store
 * - Modular component architecture
 * - Separation of concerns
 * - Better error handling and loading states
 */

interface AppProps {
  wsUrl?: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

const App: React.FC<AppProps> = ({
  wsUrl = "ws://localhost:8080/ws",
  autoReconnect = true,
  maxReconnectAttempts = 5,
}) => {
  // Get state and actions from our centralized store
  const { error, readyState, actions } = useSessionReplayStore();

  const handleCloseError = () => {
    actions.clearError();
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        bgcolor: "background.default",
        overflow: "hidden",
      }}
    >
      {/* Connection Status - Shows WebSocket connection state */}
      <ConnectionStatus readyState={readyState} />

      {/* Global Error Alert */}
      <ErrorAlert error={error} onClose={handleCloseError} />

      {/* Main Session Replay Container */}
      <SessionReplayContainer
        wsUrl={wsUrl}
        autoReconnect={autoReconnect}
        maxReconnectAttempts={maxReconnectAttempts}
      />
    </Box>
  );
};

export default App;
