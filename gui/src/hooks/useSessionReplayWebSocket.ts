import { useCallback, useRef, useEffect } from "react";
import useWebSocket from "react-use-websocket";
import type { Session, eventWithTime } from "../types";

interface WebSocketMessage {
  type: string;
  data: {
    sessionId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    sessions?: Session[];
    events?: eventWithTime[];
    isActive?: boolean;
    message?: string;
  };
}

interface UseSessionReplayWebSocketProps {
  wsUrl: string;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  onSessionsUpdate: (sessions: Session[]) => void;
  onSessionStarted: (session: Partial<Session>) => void;
  onSessionEnded: (sessionId: string) => void;
  onSessionJoined: (
    sessionId: string,
    events: eventWithTime[],
    isActive: boolean
  ) => void;
  onEventsBatch: (sessionId: string, events: eventWithTime[]) => void;
  onError: (message: string | null) => void;
}

export const useSessionReplayWebSocket = ({
  wsUrl,
  autoReconnect,
  maxReconnectAttempts,
  onSessionsUpdate,
  onSessionStarted,
  onSessionEnded,
  onSessionJoined,
  onEventsBatch,
  onError,
}: UseSessionReplayWebSocketProps) => {
  const reconnectAttempts = useRef(0);

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "active_sessions":
          if (message.data.sessions) {
            onSessionsUpdate(message.data.sessions);
          }
          break;

        case "session_started":
          if (
            message.data.sessionId &&
            message.data.userId &&
            message.data.metadata
          ) {
            onSessionStarted({
              sessionId: message.data.sessionId,
              userId: message.data.userId,
              metadata: message.data.metadata as Session["metadata"],
              eventCount: 0,
              errorCount: 0,
            });
          }
          break;

        case "session_ended":
          if (message.data.sessionId) {
            onSessionEnded(message.data.sessionId);
          }
          break;

        case "session_joined":
          if (message.data.sessionId && message.data.events) {
            onSessionJoined(
              message.data.sessionId,
              message.data.events,
              message.data.isActive ?? false
            );
          }
          break;

        case "events_batch":
          if (message.data.sessionId && message.data.events) {
            onEventsBatch(message.data.sessionId, message.data.events);
          }
          break;

        case "error":
          if (message.data.message) {
            onError(message.data.message);
          }
          break;
      }
    },
    [
      onSessionsUpdate,
      onSessionStarted,
      onSessionEnded,
      onSessionJoined,
      onEventsBatch,
      onError,
    ]
  );

  const { sendMessage, lastMessage, readyState } = useWebSocket(
    `${wsUrl}?type=viewer`,
    {
      onOpen: () => {
        console.log("Connected to session replay server");
        reconnectAttempts.current = 0;
        onError(null); // Clear any previous errors
        sendMessage(JSON.stringify({ type: "get_active_sessions" }));
      },
      onClose: () => {
        console.log("Disconnected from session replay server");
        onError("Connection lost");
      },
      onError: (event) => {
        console.error("WebSocket error:", event);
        onError("Connection error");
      },
      shouldReconnect: () => {
        if (!autoReconnect) return false;
        if (reconnectAttempts.current >= maxReconnectAttempts) {
          onError("Max reconnection attempts reached");
          return false;
        }
        reconnectAttempts.current++;
        return true;
      },
      reconnectInterval: (attemptNumber) =>
        Math.min(Math.pow(2, attemptNumber) * 1000, 10000),
    }
  );

  // Process messages
  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const message = JSON.parse(lastMessage.data);
        handleMessage(message);
      } catch (error) {
        console.error("Error parsing message:", error);
        onError("Invalid server response");
      }
    }
  }, [lastMessage, handleMessage, onError]);

  const joinSession = useCallback(
    (sessionId: string) => {
      sendMessage(
        JSON.stringify({
          type: "viewer_join_session",
          data: { sessionId },
        })
      );
    },
    [sendMessage]
  );

  const leaveSession = useCallback(
    (sessionId: string) => {
      sendMessage(
        JSON.stringify({
          type: "viewer_leave_session",
          data: { sessionId },
        })
      );
    },
    [sendMessage]
  );

  return {
    readyState,
    joinSession,
    leaveSession,
  };
};
