import { useGetSessionEventsQuery } from "@/app/services/session.service";
import { describeEvent } from "@/utils/getEventDetails";
import {
  Box,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
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
  const { data, isLoading } = useGetSessionEventsQuery({
    sessionId,
    page: currentPage,
    limit: 5, // Load 5 batches at a time
  });

  const playerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<rrwebPlayer | null>(null);

  // Deep clone function to handle frozen Redux objects
  const deepCloneEvent = (event: eventWithTime): eventWithTime => {
    return JSON.parse(JSON.stringify(event));
  };

  // Effect to handle data loading and accumulate events
  useEffect(() => {
    if (!data?.data) return;

    // Set total pages on first load
    if (totalPages === 0) {
      setTotalPages(data.pageCount);
    }

    // Flatten the events from the current page and deep clone them
    const newEvents =
      data.data
        .flat()
        .flatMap((batch) => batch.events)
        .map(deepCloneEvent) || [];

    setAllEvents((prevEvents) => {
      const updatedEvents =
        currentPage === 1 ? newEvents : [...prevEvents, ...newEvents];

      console.log(
        `Loaded page ${currentPage} of ${data.pageCount}. Page events: ${newEvents.length}, Total events: ${updatedEvents.length}`
      );

      // Create player or add new events
      if (playerRef.current) {
        if (!playerInstanceRef.current && updatedEvents.length > 0) {
          createPlayer(updatedEvents);
        } else if (currentPage > 1 && newEvents.length > 0) {
          addNewEvents(newEvents);
        }
      }

      return updatedEvents;
    });

    // Auto-load next page if there are more pages
    if (currentPage < data.pageCount) {
      const timeoutId = setTimeout(() => {
        console.log(`Auto-loading next page: ${currentPage + 1}`);
        setCurrentPage(currentPage + 1);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [data, currentPage, totalPages]);

  // Create player once with initial events
  const createPlayer = (events: eventWithTime[]) => {
    if (!playerRef.current) return;

    console.log(`Creating player with ${events.length} initial events`);

    const player = new rrwebPlayer({
      target: playerRef.current,
      props: {
        events: events, // Events are already deep cloned
        showController: true,
        height: playerRef.current.clientHeight,
        width: playerRef.current.clientWidth,
        autoPlay: true,
        speed: 1,
      },
    });

    playerInstanceRef.current = player;

    // Setup event logging
    const replayer = player.getReplayer();
    if (replayer && typeof replayer.on === "function") {
      replayer.on("event-cast", (event: unknown) => {
        console.log("🎬 Event cast during replay:", {
          event,
        });
      });

      replayer.on("custom-event", (event: unknown) => {
        console.log("🔧 Custom event cast during replay:", {
          event,
        });
      });

      replayer.on("start", () => {
        console.log("▶️ Replay started");
      });

      replayer.on("pause", () => {
        console.log("⏸️ Replay paused");
      });

      replayer.on("finish", () => {
        console.log("🏁 Replay finished");
      });
    }
  };

  // Add new events to existing player without interruption
  const addNewEvents = (newEvents: eventWithTime[]) => {
    if (!playerInstanceRef.current) return;

    console.log(`Adding ${newEvents.length} new events to existing player`);

    // Events are already deep cloned, so they should be extensible
    newEvents.forEach((event) => {
      try {
        playerInstanceRef.current?.addEvent(event);
      } catch (e) {
        console.warn("Error adding event to player:", e);
      }
    });
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.pause();
        } catch (e) {
          console.warn("Error cleaning up player:", e);
        }
      }
      const currentPlayerRef = playerRef.current;
      if (currentPlayerRef) {
        currentPlayerRef.innerHTML = "";
      }
    };
  }, []);

  const goToTime = (time: number) => {
    const startTime = allEvents[0]?.timestamp || 0;
    if (playerInstanceRef.current) {
      playerInstanceRef.current.goto(time - startTime, false);
    }
  };

  const hasMorePages = totalPages > 0 && currentPage < totalPages;
  const isLoadingComplete = totalPages > 0 && currentPage >= totalPages;

  const eventsTypeMap = allEvents.filter((e) => e.type !== 3);

  console.log("Current accumulated event types:", eventsTypeMap);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Session Replay - {sessionId}
      </Typography>

      {isLoading && (
        <Typography>
          Loading events... (Page {currentPage} of {totalPages || "?"})
        </Typography>
      )}

      {hasMorePages && !isLoading && (
        <Typography>
          Streaming events... ({allEvents.length} events loaded, page{" "}
          {currentPage} of {totalPages})
        </Typography>
      )}

      {isLoadingComplete && allEvents.length > 0 && (
        <Typography>
          All events loaded ({allEvents.length} total events from {totalPages}{" "}
          pages)
        </Typography>
      )}

      <Grid container spacing={2}>
        <Grid size={6}>
          <Box
            ref={playerRef}
            sx={{
              width: "100%", // 50% of viewport width
              aspectRatio: "16 / 10", // maintain 16:10 ratio
              borderRadius: 1,
            }}
          ></Box>
        </Grid>
        <Grid size={6}>
          <Paper variant="outlined">
            <Stack divider={<Divider />}>
              <Stack p={1}>
                <Typography variant="h6" gutterBottom>
                  Event Log
                </Typography>
              </Stack>
              <Stack
                maxHeight={playerRef.current?.clientHeight}
                sx={{ overflowY: "auto" }}
              >
                <Stack p={1} spacing={1}>
                  {allEvents
                    .filter((e) => e.type !== 3)
                    .map((event, index) => (
                      <Box
                        key={index}
                        sx={{ display: "flex", alignItems: "center" }}
                      >
                        <Typography
                          onClick={() => goToTime(event.timestamp)}
                          variant="body2"
                        >
                          [{new Date(event.timestamp).toLocaleTimeString()}] -{" "}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          {Object.entries(describeEvent(event).extra || {})
                            .filter(([_, value]) =>
                              ["string", "number"].includes(typeof value)
                            )
                            .map(([key, value]) => (
                              <Chip
                                key={key}
                                label={`${key}: ${value}`}
                                size="small"
                              />
                            ))}
                        </Stack>
                      </Box>
                    ))}
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SessionDetailsPage;
