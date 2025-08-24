import { useGetSessionEventsQuery } from "@/app/services/session.service";
import { Box, Typography } from "@mui/material";
import { eventWithTime } from "@rrweb/types";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import rrwebPlayer from "rrweb-player";
import "rrweb-player/dist/style.css";

const SessionDetailsPage = () => {
  const params = useParams();
  const sessionId = params["session-id"] as string;

  const [allEvents, setAllEvents] = useState<eventWithTime[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Load current page
  const { data, isLoading, isError, error } = useGetSessionEventsQuery({
    sessionId,
    page: currentPage,
    limit: 5, // Load 5 batches at a time
  });

  const playerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<InstanceType<typeof rrwebPlayer> | null>(
    null
  );

  // Effect to handle data loading and accumulate events
  useEffect(() => {
    if (!data?.data) return;

    // Set total pages on first load
    if (totalPages === 0) {
      setTotalPages(data.pageCount);
    }

    // Flatten the events from the current page
    const newEvents = data.data.flat().flatMap((batch) => batch.events) || [];

    setAllEvents((prevEvents) => {
      // For page 1, replace all events. For subsequent pages, append
      const updatedEvents =
        currentPage === 1 ? newEvents : [...prevEvents, ...newEvents];

      console.log(
        `Loaded page ${currentPage} of ${data.pageCount}. Page events: ${newEvents.length}, Total events: ${updatedEvents.length}`
      );

      // Create/update player with accumulated events
      if (playerRef.current && updatedEvents.length > 0) {
        createOrUpdatePlayer(updatedEvents);
      }

      return updatedEvents;
    });

    // Auto-load next page if there are more pages
    if (currentPage < data.pageCount) {
      const timeoutId = setTimeout(() => {
        console.log(`Auto-loading next page: ${currentPage + 1}`);
        setCurrentPage(currentPage + 1);
      }, 500); // 500ms delay between page loads

      return () => clearTimeout(timeoutId);
    }
  }, [data, currentPage, totalPages]);

  // Function to create or update the player
  const createOrUpdatePlayer = (events: eventWithTime[]) => {
    if (!playerRef.current) return;

    // Deep clone to strip Redux freeze
    const cleanEvents = events.map((e) => ({ ...e }));

    console.log(`Updating player with ${cleanEvents.length} total events`);

    // Destroy existing player if it exists
    if (playerInstanceRef.current) {
      try {
        playerInstanceRef.current.pause();
      } catch (e) {
        console.warn("Error pausing existing player:", e);
      }
    }

    // Clear the container to prevent multiple players
    if (playerRef.current) {
      playerRef.current.innerHTML = "";
    }

    // Create new player with all accumulated events
    const player = new rrwebPlayer({
      target: playerRef.current,
      props: {
        events: cleanEvents,
        showController: true,
        height: playerRef.current.clientHeight,
        width: playerRef.current.clientWidth,
      },
    });

    playerInstanceRef.current = player;

    // Try to access the underlying replayer instance for event logging
    const playerInstance = player as unknown as {
      getReplayer?: () => unknown;
      replayer?: unknown;
      $replayer?: unknown;
    };

    let replayerInstance = null;
    if (typeof playerInstance.getReplayer === "function") {
      replayerInstance = playerInstance.getReplayer();
    } else if (playerInstance.replayer) {
      replayerInstance = playerInstance.replayer;
    } else if (playerInstance.$replayer) {
      replayerInstance = playerInstance.$replayer;
    }

    if (
      replayerInstance &&
      typeof (replayerInstance as { on?: unknown }).on === "function"
    ) {
      const replayerWithEvents = replayerInstance as {
        on: (eventName: string, callback: (data?: unknown) => void) => void;
      };

      // Listen to events during replay
      replayerWithEvents.on("event-cast", (event: unknown) => {
        const eventData = event as eventWithTime;
        console.log("🎬 Event cast during replay:", {
          type: eventData.type,
          timestamp: eventData.timestamp,
          event: eventData,
        });
      });

      replayerWithEvents.on("custom-event", (event: unknown) => {
        const eventData = event as eventWithTime;
        console.log("🔧 Custom event cast during replay:", {
          type: eventData.type,
          timestamp: eventData.timestamp,
          event: eventData,
        });
      });

      replayerWithEvents.on("start", () => console.log("▶️ Replay started"));
      replayerWithEvents.on("pause", () => console.log("⏸️ Replay paused"));
      replayerWithEvents.on("finish", () => console.log("🏁 Replay finished"));
    }
  };

  // Cleanup effect
  useEffect(() => {
    const currentPlayerRef = playerRef.current;
    return () => {
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.pause();
        } catch (e) {
          console.warn("Error cleaning up player:", e);
        }
      }
      // Clear the container on cleanup
      if (currentPlayerRef) {
        currentPlayerRef.innerHTML = "";
      }
    };
  }, []);

  console.log("Session events data:", data, isLoading, isError, error);

  const hasMorePages = totalPages > 0 && currentPage < totalPages;
  const isLoadingComplete = totalPages > 0 && currentPage >= totalPages;

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Session Replay - {sessionId}
        </Typography>
        {isLoading && (
          <Typography variant="body2" color="text.secondary">
            Loading events... (Page {currentPage} of {totalPages || "?"})
          </Typography>
        )}
        {hasMorePages && !isLoading && (
          <Typography variant="body2" color="text.secondary">
            Streaming events... ({allEvents.length} events loaded, page{" "}
            {currentPage} of {totalPages})
          </Typography>
        )}
        {isLoadingComplete && allEvents.length > 0 && (
          <Typography variant="body2" color="success.main">
            All events loaded ({allEvents.length} total events from {totalPages}{" "}
            pages)
          </Typography>
        )}
      </Box>

      <Box
        ref={playerRef}
        sx={{ width: "747px", height: "420px", background: "#000" }}
      />
    </Box>
  );
};

export default SessionDetailsPage;
