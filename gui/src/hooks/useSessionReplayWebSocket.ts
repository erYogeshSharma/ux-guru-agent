import { useCallback, useRef, useEffect } from "react";
import useWebSocket from "react-use-websocket";
import type { Session, eventWithTime } from "../types";

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

  // Store external handler callbacks in a ref so we don't force
  // re-creation of message handlers and useEffect dependencies.
  const handlersRef = useRef({
    onSessionsUpdate,
    onSessionStarted,
    onSessionEnded,
    onSessionJoined,
    onEventsBatch,
    onError,
  });

  // Keep the ref up-to-date when parent callbacks change. This
  // effect is intentionally minimal and won't cause the message
  // processing effect to re-run.
  useEffect(() => {
    handlersRef.current = {
      onSessionsUpdate,
      onSessionStarted,
      onSessionEnded,
      onSessionJoined,
      onEventsBatch,
      onError,
    };
  }, [
    onSessionsUpdate,
    onSessionStarted,
    onSessionEnded,
    onSessionJoined,
    onEventsBatch,
    onError,
  ]);

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

  // Process websocket messages. Only depend on `lastMessage` and
  // `sendMessage` so we don't retrigger this effect when parent
  // callbacks change; handlers are read from `handlersRef`.
  useEffect(() => {
    if (lastMessage === null) return;

    try {
      const message = JSON.parse(lastMessage.data);

      // If server informed viewer that it joined but did not include events,
      // request the first page of events via the websocket so we stream
      // rather than receiving a huge payload at once.
      if (message.type === "session_joined") {
        const sessionId = message.data?.sessionId;
        const events = message.data?.events;
        const isActive = message.data?.isActive ?? false;

        if (sessionId) {
          if (Array.isArray(events) && events.length > 0) {
            // Server provided initial events — treat as joined with data
            handlersRef.current.onSessionJoined(sessionId, events, isActive);
          } else {
            // No events included; request first page from server
            sendMessage(
              JSON.stringify({
                type: "get_session_events",
                data: { sessionId, fromIndex: 0 },
              })
            );
          }
        }

        return;
      }

      // Handle paged session events returned from server
      if (message.type === "session_events") {
        const sessionId = message.data?.sessionId;
        const events = message.data?.events;
        const fromIndex = message.data?.fromIndex ?? 0;
        const isActive = message.data?.isActive ?? false;

        if (sessionId && Array.isArray(events)) {
          if (fromIndex === 0) {
            handlersRef.current.onSessionJoined(sessionId, events, isActive);
          } else {
            handlersRef.current.onEventsBatch(sessionId, events);
          }
        }

        return;
      }

      // Fallback for other message types
      switch (message.type) {
        case "active_sessions":
          if (message.data.sessions) {
            handlersRef.current.onSessionsUpdate(message.data.sessions);
          }
          break;

        case "session_started":
          if (
            message.data.sessionId &&
            message.data.userId &&
            message.data.metadata
          ) {
            handlersRef.current.onSessionStarted({
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
            handlersRef.current.onSessionEnded(message.data.sessionId);
          }
          break;

        case "events_batch":
          if (message.data.sessionId && message.data.events) {
            handlersRef.current.onEventsBatch(
              message.data.sessionId,
              message.data.events
            );
          }
          break;

        case "error":
          if (message.data.message) {
            handlersRef.current.onError(message.data.message);
          }
          break;
      }
    } catch (error) {
      console.error("Error parsing message:", error);
      handlersRef.current.onError("Invalid server response");
    }
  }, [lastMessage, sendMessage]);

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
