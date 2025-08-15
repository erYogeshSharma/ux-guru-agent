import React, { useState, useRef, useCallback, useMemo } from "react";
import { Box, Stack } from "@mui/material";
import {
  SessionList,
  WelcomeScreen,
  ConnectionStatus,
  ErrorAlert,
  SessionInfo,
  LoadingOverlay,
} from "./components";
import { useSessionReplayWebSocket } from "./hooks";
import type { Session, SessionReplayViewerProps, eventWithTime } from "./types";
import rrwebPlayer from "rrweb-player";
import "rrweb-player/dist/style.css";

// --- File overview ---------------------------------------------------------
// SessionReplayViewer manages live/recorded session replays using rrweb-player
// which provides built-in UI controls. Key responsibilities:
// - Maintain session list, selected session, and replay events.
// - Initialize and control an rrweb-player instance attached to
//   the containerRef DOM node.
// - Handle incoming websocket events and update UI state.
//
// rrweb-player provides built-in controls so we don't need custom playback logic.

// --- Simple toggleable logger wrapper -------------------------------------
// Use `setLogEnabled(false)` to disable all logging at runtime.
let logEnabled = true;
// Toggle runtime logging for debugging. Kept non-exported to avoid breaking
// fast-refresh rules that expect files to only export React components.
const setLogEnabled = (enabled: boolean) => {
  logEnabled = enabled;
};

// Expose a dev-friendly toggle on window so you can run
// `window.__setLogEnabled(false)` in the console to disable logs.
if (typeof window !== "undefined") {
  // Attach for dev-time toggling without using `any`.
  (
    window as Window & { __setLogEnabled?: (enabled: boolean) => void }
  ).__setLogEnabled = setLogEnabled;
}

// Internal logger wrapper using console signatures to avoid `any`.
type LogArgs = Parameters<typeof console.log>;
const logger = {
  log: (...args: LogArgs) => {
    if (logEnabled) console.log(...args);
  },
  debug: (...args: LogArgs) => {
    if (logEnabled) console.debug(...args);
  },
  info: (...args: LogArgs) => {
    if (logEnabled) console.info(...args);
  },
  warn: (...args: LogArgs) => {
    if (logEnabled) console.warn(...args);
  },
  error: (...args: LogArgs) => {
    if (logEnabled) console.error(...args);
  },
};

const SessionReplayViewer: React.FC<SessionReplayViewerProps> = ({
  wsUrl = "ws://localhost:8080/ws",
  autoReconnect = true,
  maxReconnectAttempts = 5,
}) => {
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionEvents, setSessionEvents] = useState<eventWithTime[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState(true);

  // Reference to the rrweb-player instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  setLogEnabled(true); // Enable logging by default
  // WebSocket handlers
  // Called when the server sends the full list of sessions.
  // Replaces the local `activeSessions` state with the provided list.
  const handleSessionsUpdate = useCallback((sessions: Session[]) => {
    // Log entry and data for debugging
    logger.debug(
      "enter: handleSessionsUpdate in SessionReplayViewer (App.tsx)",
      { sessions }
    );

    setActiveSessions(sessions);
  }, []);

  // Called when a new session starts on the server.
  // Adds the session to `activeSessions` if not already present.
  const handleSessionStarted = useCallback((session: Partial<Session>) => {
    // Called when a new session starts (live)
    logger.debug(
      "enter: handleSessionStarted in SessionReplayViewer (App.tsx)",
      {
        session,
      }
    );

    setActiveSessions((prev) => {
      const exists = prev.find((s) => s.sessionId === session.sessionId);
      if (exists) return prev;

      return [...prev, session as Session];
    });
  }, []);

  // Called when a session ends on the server.
  // Removes the session from `activeSessions` and clears live state if needed.
  const handleSessionEnded = useCallback(
    (sessionId: string) => {
      // Session ended (cleanup state)
      logger.debug(
        "enter: handleSessionEnded in SessionReplayViewer (App.tsx)",
        {
          sessionId,
        }
      );

      setActiveSessions((prev) =>
        prev.filter((session) => session.sessionId !== sessionId)
      );
      if (selectedSession === sessionId) {
        setIsLive(false);
      }
    },
    [selectedSession]
  );

  // Generic error handler invoked by the websocket hook.
  // Stores the error message and stops loading indicators.
  const handleError = useCallback((message: string | null) => {
    logger.error("enter: handleError in SessionReplayViewer (App.tsx)", {
      message,
    });

    setError(message);
    setLoading(false);
  }, []);

  // Create and attach an rrweb-player to `containerRef` using the provided
  // events. The player includes built-in controls.
  const initializePlayer = useCallback(
    (events: eventWithTime[], isActiveSession: boolean) => {
      logger.debug("enter: initializePlayer in SessionReplayViewer (App.tsx)", {
        isActiveSession,
        eventsLength: events.length,
      });

      if (!containerRef.current || events.length === 0) return;

      // Clear container
      containerRef.current.innerHTML = "";

      try {
        // Destroy existing player if any
        if (playerRef.current) {
          // rrweb-player doesn't have a destroy method, so we clear the container
          containerRef.current.innerHTML = "";
        }
        console.log(
          containerRef.current.clientHeight,
          containerRef.current.clientWidth
        );
        // Create new rrweb-player instance
        playerRef.current = new rrwebPlayer({
          target: containerRef.current,
          props: {
            events: events,
            width: containerRef.current.clientWidth || 1024,
            // height: containerRef.current.clientHeight || 576,
            autoPlay: isActiveSession && isLive,
            showController: true,
            speed: 1,
            UNSAFE_replayCanvas: true,
            speedOption: [0.5, 1, 1.5, 2, 4],
          },
        });

        logger.info("initializePlayer: player created", {
          isActiveSession,
          isLive,
          eventsLength: events.length,
        });
      } catch (error) {
        logger.error(
          "Error initializing player in SessionReplayViewer (App.tsx):",
          error
        );
        setError("Failed to initialize replay");
      }
    },
    [isLive]
  );

  // Called after successfully joining a session; receives the initial
  // event batch. Sets local events and initializes the player.
  const handleSessionJoined = useCallback(
    (sessionId: string, events: eventWithTime[], isActive: boolean) => {
      logger.debug(
        "enter: handleSessionJoined in SessionReplayViewer (App.tsx)",
        {
          sessionId,
          eventsLength: events.length,
          isActive,
        }
      );

      if (sessionId === selectedSession) {
        setSessionEvents(events);
        setLoading(false);
        // Initialize the player with the events
        initializePlayer(events, isActive);
      }
    },
    [selectedSession, initializePlayer]
  );

  // Handle incremental batches of events for a session (live updates).
  // Appends events to the current session and forwards them to the player.
  const handleEventsBatch = useCallback(
    (sessionId: string, events: eventWithTime[]) => {
      logger.debug(
        "enter: handleEventsBatch in SessionReplayViewer (App.tsx)",
        {
          sessionId,
          eventsLength: events.length,
        }
      );

      if (sessionId === selectedSession && isLive) {
        const newEvents = events;
        // Log batches for debugging; can be turned off via setLogEnabled(false)
        logger.debug("handleEventsBatch data:", {
          newEventsLength: newEvents.length,
        });

        setSessionEvents((prev) => {
          const updatedEvents = [...prev, ...newEvents];

          // Update the player with new events
          if (playerRef.current) {
            newEvents.forEach((event: eventWithTime) => {
              console.log("Type", event.type);
              if (
                event.data &&
                typeof event.data === "object" &&
                "source" in event.data
              ) {
                console.log(
                  "Source",
                  (event.data as { source?: string }).source
                );
              }
              if (
                event.data &&
                typeof event.data === "object" &&
                "type" in event.data
              ) {
                console.log("Type", (event.data as { type?: string }).type);
              }
              console.log("Adding event to player:", event);
              console.log("--------------------------");
              playerRef.current?.addEvent(event);
            });
          }

          return updatedEvents;
        });
      }

      // Update event count for the session (defensive guard if missing)
      setActiveSessions((prev) =>
        prev.map((session) =>
          session.sessionId === sessionId
            ? {
                ...session,
                // Guard against undefined eventCount
                eventCount: (session.eventCount ?? 0) + events.length,
              }
            : session
        )
      );
    },
    [selectedSession, isLive]
  );

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

  // User selected a session to join. Clears previous player and requests
  // the session from the websocket hook.
  const joinSession = useCallback(
    (sessionId: string) => {
      logger.debug("enter: joinSession in SessionReplayViewer (App.tsx)", {
        sessionId,
        selectedSession,
      });

      if (selectedSession === sessionId) return;

      setSelectedSession(sessionId);
      setIsLive(true);
      setSessionEvents([]);
      setLoading(true);
      setError(null);

      // Clear the container for the new player
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      playerRef.current = null;

      wsJoinSession(sessionId);
    },
    [selectedSession, wsJoinSession]
  );

  // Leave the currently selected session. Cleans up player and resets state.
  const leaveSession = useCallback(() => {
    logger.debug("enter: leaveSession in SessionReplayViewer (App.tsx)", {
      selectedSession,
    });

    if (selectedSession) {
      wsLeaveSession(selectedSession);
    }

    setSelectedSession(null);
    setIsLive(false);
    setSessionEvents([]);
    setLoading(false);

    // Clear the player
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
    playerRef.current = null;
  }, [selectedSession, wsLeaveSession]);

  // Format a timestamp (ms) as a locale time string for display in lists.
  const formatTime = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  }, []);

  // Format difference between two timestamps into H:MM:SS or M:SS.
  const formatDuration = useCallback(
    (startTime: number, lastActivity: number) => {
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
    },
    []
  );

  const filteredSessions = useMemo(() => {
    return activeSessions.filter((session) => {
      const matchesSearch =
        searchQuery === "" ||
        session.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.metadata.url.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [activeSessions, searchQuery]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        bgcolor: "background.default",
      }}
    >
      {/* Connection Status */}
      <ConnectionStatus readyState={readyState} />

      {/* Error Alert */}
      <ErrorAlert error={error} onClose={() => setError(null)} />

      <Box sx={{ display: "flex" }}>
        {/* Session List Sidebar */}

        <SessionList
          sessions={filteredSessions}
          selectedSessionId={selectedSession}
          searchQuery={searchQuery}
          filterActive={filterActive}
          onSessionSelect={joinSession}
          onSearchChange={setSearchQuery}
          onFilterChange={setFilterActive}
          formatTime={formatTime}
          formatDuration={formatDuration}
        />

        {/* Main Content Area */}
        <Stack width="100%">
          <Stack alignItems="center">
            {selectedSession ? (
              <>
                {/* Session Info */}
                <SessionInfo
                  sessionId={selectedSession}
                  isLive={isLive}
                  eventCount={sessionEvents.length}
                  onLeaveSession={leaveSession}
                />

                {/* Loading Overlay */}
                <LoadingOverlay open={loading} />

                {/* Player Container */}
                <Box
                  ref={containerRef}
                  className="replayer-container"
                  sx={{
                    flex: 1,
                    overflow: "auto",

                    width: "800px",

                    maxWidth: "100vw",
                  }}
                />
              </>
            ) : (
              /* Welcome Screen */
              <WelcomeScreen />
            )}
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};

export default SessionReplayViewer;
