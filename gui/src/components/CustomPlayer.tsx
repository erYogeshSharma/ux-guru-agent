import React, { useRef, useEffect, useState } from "react";
import {
  Box,
  Paper,
  Stack,
  IconButton,
  Slider,
  Typography,
  Tooltip,
  Chip,
  ToggleButton,
} from "@mui/material";
import {
  PlayArrow,
  Pause,
  Speed,
  Fullscreen,
  FullscreenExit,
  FastForward,
  FastRewind,
  Tune,
} from "@mui/icons-material";
import rrwebPlayer from "rrweb-player";
import type { eventWithTime } from "../types";
import { useSessionReplayStore } from "../hooks/useSessionReplayStore";
import { sessionReplayActions } from "../store/sessionReplayStore";
import "rrweb-player/dist/style.css";
import { grey } from "@mui/material/colors";
interface CustomPlayerProps {
  events: eventWithTime[];
  width?: number;
  height?: number;
  showController?: boolean;
  autoPlay?: boolean;
  className?: string;
}

interface PlayerInstance {
  toggle: () => void;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  goto: (time: number) => void;
  toggleSkipInactive: () => void;
  triggerResize: () => void;
  $set: (props: { width?: number; height?: number }) => void;
  addEventListener: (
    event: string,
    callback: (event: { payload: unknown }) => void
  ) => void;
  removeEventListener: (
    event: string,
    callback: (event: { payload: unknown }) => void
  ) => void;
}

const CustomPlayer: React.FC<CustomPlayerProps> = ({
  events,
  width = 1024,
  height = 576,
  showController = false,
  autoPlay = false,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerInstance | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const lastEventCountRef = useRef<number>(0);
  const initializingRef = useRef<boolean>(false);
  const eventsRef = useRef<eventWithTime[]>([]);
  const wasPlayingRef = useRef<boolean>(false); // Track if player was playing before update
  const currentSessionIdRef = useRef<string | null>(null); // Track current session
  const isIncrementalUpdateRef = useRef<boolean>(false); // Track if this is an incremental update

  // Use our custom hook
  const { playerState, isLive, selectedSession } = useSessionReplayStore();

  // Reset timer when session changes
  useEffect(() => {
    if (currentSessionIdRef.current !== selectedSession) {
      console.log("Session changed, resetting player state");
      sessionReplayActions.updatePlayerState({
        currentTime: 0,
        totalTime: 0,
        progress: 0,
        isPlaying: false,
      });
      currentSessionIdRef.current = selectedSession;
      wasPlayingRef.current = false;
    }
  }, [selectedSession]);

  // Update events ref when events change
  useEffect(() => {
    eventsRef.current = events;
    const eventTypes = new Set<string | number>();
    events.forEach((event) => {
      if (event && event.type) {
        eventTypes.add(event.type);
      }
    });
    console.log("Event types:", Array.from(eventTypes));
  }, [events]);

  // Helper function to set up player event listeners
  const setupPlayerListeners = (
    player: PlayerInstance,
    currentEvents: eventWithTime[]
  ) => {
    // Calculate baseline timestamp for proper time calculation
    const baseTimestamp =
      currentEvents.length > 0 ? currentEvents[0].timestamp : 0;

    // Use requestAnimationFrame to defer store updates and break the update loop
    requestAnimationFrame(() => {
      // Set up event listeners for player state updates
      player.addEventListener("ui-update-current-time", (event) => {
        const relativeTime = event.payload as number;
        // Convert to actual time from start of session
        const currentTime = baseTimestamp + relativeTime;

        // Debug logging for timer issues
        if (relativeTime % 5000 < 100) {
          // Log every 5 seconds
          console.log(
            `Timer update - Relative: ${relativeTime}ms, Base: ${baseTimestamp}, Current: ${currentTime}`
          );
        }

        // Use requestAnimationFrame to defer store updates and break the update loop
        requestAnimationFrame(() => {
          sessionReplayActions.updatePlayerState({
            currentTime: relativeTime, // Keep relative time for seeking
            actualCurrentTime: currentTime, // Store actual timestamp
          });
        });
      });

      player.addEventListener("ui-update-player-state", (event) => {
        const state = event.payload as string;
        const isPlaying = state === "playing";
        // Update ref to track playing state
        wasPlayingRef.current = isPlaying;
        requestAnimationFrame(() => {
          sessionReplayActions.updatePlayerState({
            isPlaying: isPlaying,
          });
        });
      });

      player.addEventListener("ui-update-progress", (event) => {
        const progress = event.payload as number;
        requestAnimationFrame(() => {
          sessionReplayActions.updatePlayerState({
            progress: progress * 100, // Convert to percentage
          });
        });
      });

      player.addEventListener("custom-event", (event) => {
        console.log("Custom event received:", event.payload);
      });

      // Calculate total time from events and update store
      if (currentEvents.length > 1) {
        const totalTime =
          currentEvents[currentEvents.length - 1].timestamp -
          currentEvents[0].timestamp;
        requestAnimationFrame(() => {
          sessionReplayActions.updatePlayerState({
            totalTime: totalTime,
          });
        });
      }

      // Update store with player instance
      setTimeout(() => {
        sessionReplayActions.setPlayerInstance(player);
      }, 0);
    });
  };

  // Effect to handle player initialization
  useEffect(() => {
    const currentEvents = eventsRef.current;

    // Don't reinitialize if:
    // 1. Already initializing
    // 2. No container
    // 3. No events
    if (
      initializingRef.current ||
      !containerRef.current ||
      currentEvents.length === 0
    ) {
      return;
    }

    // For live sessions, be more conservative about reinitialization
    // Key behaviors:
    // 1. Small incremental updates (<20 events) avoid player recreation entirely
    // 2. If player was playing, it continues playing at the same position
    // 3. If player was paused, it stays paused at the same position
    // 4. Only fresh starts or major changes recreate the player
    if (isLive && playerRef.current) {
      const eventCountDiff = currentEvents.length - lastEventCountRef.current;

      // If only a few new events and player exists, avoid recreation entirely
      if (
        eventCountDiff > 0 &&
        eventCountDiff < 20 &&
        eventCountDiff < currentEvents.length * 0.1
      ) {
        console.log(
          `Live session: adding ${eventCountDiff} new events, preserving player without recreation`
        );

        // Update the event count and total time without recreation
        lastEventCountRef.current = currentEvents.length;
        eventsRef.current = currentEvents;

        // Update total time in store only
        if (currentEvents.length > 1) {
          const newTotalTime =
            currentEvents[currentEvents.length - 1].timestamp -
            currentEvents[0].timestamp;

          // Only update total time, don't touch currentTime to avoid slider jumping
          sessionReplayActions.updatePlayerState({
            totalTime: newTotalTime,
          });
        }

        console.log(`Live session: updated total time, keeping player as-is`);

        // If the player is currently playing and near the end, let it continue naturally
        // The new total time will be reflected in the progress bar
        const currentTime = playerState.currentTime || 0;
        const oldTotalTime = playerState.totalTime || 0;

        if (wasPlayingRef.current && currentTime > oldTotalTime * 0.9) {
          console.log(
            `Player is near end (${currentTime}/${oldTotalTime}), new events will extend playback`
          );
        }

        // Skip recreation entirely for small updates
        return;
      } else {
        // Major change, recreate player
        console.log(
          `Live session: major change (${eventCountDiff} events), recreating player`
        );
        isIncrementalUpdateRef.current = false;
      }
    } else {
      // New session or first initialization
      isIncrementalUpdateRef.current = false;
    }

    // Full reinitialization for new sessions or major changes
    console.log("Initializing player with", currentEvents.length, "events");
    initializingRef.current = true;

    // Use setTimeout to defer the initialization and break any synchronous loops
    const timeoutId = setTimeout(() => {
      const latestEvents = eventsRef.current;
      if (!containerRef.current || latestEvents.length === 0) {
        initializingRef.current = false;
        return;
      }

      try {
        // Clean up existing player instance
        if (playerRef.current) {
          playerRef.current = null;
        }

        // Clear container
        containerRef.current.innerHTML = "";

        // Create new player instance
        const player = new rrwebPlayer({
          target: containerRef.current,
          props: {
            events: latestEvents,
            width: containerRef.current.clientWidth || width,
            height: containerRef.current.clientHeight || height,
            autoPlay,
            showController,
            speed: 1,
            UNSAFE_replayCanvas: true,
            speedOption: [0.5, 1, 1.5, 2, 4],
          },
        }) as unknown as PlayerInstance;

        // Set up event listeners
        setupPlayerListeners(player, latestEvents);

        // Store player instance in ref
        playerRef.current = player;
        lastEventCountRef.current = latestEvents.length;

        console.log("Player initialized with", latestEvents.length, "events");

        // For live sessions, handle state preservation vs. fresh start
        if (isLive) {
          setTimeout(() => {
            const totalTime =
              latestEvents.length > 1
                ? latestEvents[latestEvents.length - 1].timestamp -
                  latestEvents[0].timestamp
                : 0;

            // Check if this is an incremental update (we have previous state to preserve)
            const shouldPreserveState =
              isIncrementalUpdateRef.current &&
              wasPlayingRef.current !== undefined &&
              playerState.currentTime !== undefined &&
              playerState.currentTime > 0;

            if (shouldPreserveState) {
              // Preserve previous position and playing state for incremental updates
              const preservedPosition = Math.min(
                playerState.currentTime,
                totalTime
              );
              console.log(
                `Preserving live session state: position=${preservedPosition}, playing=${wasPlayingRef.current}`
              );

              player.goto(preservedPosition);

              setTimeout(() => {
                if (wasPlayingRef.current) {
                  player.play();
                  console.log(
                    "Resumed live session playback at",
                    preservedPosition,
                    "ms"
                  );
                } else {
                  console.log("Staying paused at", preservedPosition, "ms");
                }
              }, 100);
            } else {
              // Fresh start - go to near the end and auto-play
              const seekTime = Math.max(0, totalTime - 2000);
              player.goto(seekTime);

              setTimeout(() => {
                player.play();
                wasPlayingRef.current = true;
                console.log("Live session auto-playing from", seekTime, "ms");
              }, 100);
            }

            // Reset the incremental update flag
            isIncrementalUpdateRef.current = false;
          }, 200);
        } else if (autoPlay) {
          // Non-live sessions start from beginning if autoPlay is enabled
          setTimeout(() => {
            player.play();
          }, 100);
        }
      } catch (error) {
        console.error("Failed to initialize player:", error);
        setTimeout(() => {
          sessionReplayActions.setError("Failed to initialize player");
        }, 0);
      } finally {
        initializingRef.current = false;
      }
    }, 0);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    events.length,
    width,
    height,
    autoPlay,
    showController,
    isLive,
    selectedSession,
    speed,
  ]); // Add selectedSession to trigger reinit on session change

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playerRef.current = null;
      sessionReplayActions.setPlayerInstance(null);
    };
  }, []); // Empty dependency array - only run on unmount

  // Live session timer update effect
  useEffect(() => {
    if (!isLive || !playerRef.current || events.length === 0) {
      return;
    }

    // For live sessions, continuously update the total time as new events come in
    // and keep the current time moving if the player is playing
    const interval = setInterval(() => {
      if (events.length > 1) {
        const newTotalTime =
          events[events.length - 1].timestamp - events[0].timestamp;

        // If player is playing and we're near the end, update current time to keep it moving
        if (playerState.isPlaying) {
          const currentTime = playerState.currentTime || 0;
          const totalTime = playerState.totalTime || 0;

          // If we're within 2 seconds of the end, keep the timer moving forward
          if (totalTime > 0 && currentTime > totalTime - 2000) {
            const now = Date.now();
            const sessionStart = events[0].timestamp;
            const liveCurrentTime = now - sessionStart;

            sessionReplayActions.updatePlayerState({
              currentTime: Math.min(liveCurrentTime, newTotalTime),
              totalTime: Math.max(newTotalTime, liveCurrentTime),
            });
          } else {
            sessionReplayActions.updatePlayerState({
              totalTime: newTotalTime,
            });
          }
        } else {
          sessionReplayActions.updatePlayerState({
            totalTime: newTotalTime,
          });
        }
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [
    isLive,
    events.length,
    events,
    playerState.isPlaying,
    playerState.currentTime,
    playerState.totalTime,
  ]);

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen && containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Control handlers
  const handlePlayPause = () => {
    if (playerRef.current) {
      playerRef.current.toggle();
    }
  };

  const handleSpeedChange = (_event: Event, newValue: number | number[]) => {
    const speedValue = Array.isArray(newValue) ? newValue[0] : newValue;
    setSpeed(speedValue);
    if (playerRef.current) {
      playerRef.current.setSpeed(speedValue);
      sessionReplayActions.updatePlayerState({ speed: speedValue });
    }
  };

  const handleSeek = (_event: Event, newValue: number | number[]) => {
    const time = Array.isArray(newValue) ? newValue[0] : newValue;
    if (playerRef.current && !isNaN(time) && time >= 0) {
      // Prevent feedback loops by checking if this is a significant change
      const currentTime = playerState.currentTime;
      const timeDiff = Math.abs(time - currentTime);

      if (timeDiff > 500) {
        // Only seek if difference is more than 500ms to reduce jitter
        console.log(`Seeking to: ${time}ms from current: ${currentTime}ms`);
        playerRef.current.goto(time);
        // Update store immediately for better responsiveness
        sessionReplayActions.updatePlayerState({
          currentTime: time,
        });
      }
    }
  };

  const handleSkipInactive = () => {
    if (playerRef.current) {
      playerRef.current.toggleSkipInactive();
      sessionReplayActions.updatePlayerState({
        skipInactive: !playerState.skipInactive,
      });
    }
  };

  const formatTime = (timeInMs: number | undefined | null) => {
    // Handle edge cases
    if (!timeInMs || timeInMs < 0 || !isFinite(timeInMs) || isNaN(timeInMs)) {
      return "0:00";
    }

    // Convert to seconds and handle fractional seconds properly
    const totalSeconds = Math.floor(Math.abs(timeInMs) / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (events.length === 0) {
    return (
      <Paper
        className={className}
        sx={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "grey.100",
        }}
      >
        <Box textAlign="center" color="text.secondary">
          <Typography
            variant="h1"
            component="div"
            sx={{ fontSize: "4rem", mb: 2 }}
          >
            📹
          </Typography>
          <Typography variant="body1">No events to replay</Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Stack width="100%">
      <Stack alignItems="center" sx={{ width: "100%" }}>
        {/* Player Container */}
        <Box
          ref={containerRef}
          sx={{
            bgcolor: "black",
            overflow: "hidden",
            boxShadow: 1,
            aspectRatio: "16 / 10",
            width: "min(calc(50vh * (16 / 10)), 100vw)",
            height: "auto",
            maxHeight: "80vh",
          }}
        />

        {/* Custom MUI Controls */}
        {!showController && playerRef.current && (
          <Box
            sx={{
              px: 2,
              mt: 1,
              background: grey[900],
              width: containerRef.current
                ? containerRef.current.offsetWidth
                : 0,
            }}
          >
            {/* Top Controls Row */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              mb={1}
            >
              {/* Play Controls */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Tooltip title="Skip to start">
                  <IconButton
                    size="small"
                    onClick={() => playerRef.current?.goto(0)}
                    sx={{ color: "white" }}
                  >
                    <FastRewind />
                  </IconButton>
                </Tooltip>
                <Tooltip title={playerState.isPlaying ? "Pause" : "Play"}>
                  <IconButton
                    onClick={handlePlayPause}
                    sx={{ color: "primary.main" }}
                    size="small"
                  >
                    {playerState.isPlaying ? <Pause /> : <PlayArrow />}
                  </IconButton>
                </Tooltip>

                <Tooltip title="Skip to end">
                  <IconButton
                    size="small"
                    onClick={() =>
                      playerRef.current?.goto(playerState.totalTime)
                    }
                    sx={{ color: "white" }}
                  >
                    <FastForward />
                  </IconButton>
                </Tooltip>
              </Stack>

              {/* Speed Control */}
              <Stack direction="row" alignItems="center" spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Speed sx={{ color: "white" }} />
                  <Typography variant="body2" color="white" minWidth="30px">
                    {speed}x
                  </Typography>
                </Stack>

                <Slider
                  value={speed}
                  onChange={handleSpeedChange}
                  min={0.5}
                  max={4}
                  step={0.5}
                  marks={[
                    { value: 0.5 },
                    { value: 1 },
                    { value: 2 },
                    { value: 4 },
                  ]}
                  sx={{
                    width: 120,
                    color: "primary.main",
                    "& .MuiSlider-thumb": { color: "primary.main" },
                    "& .MuiSlider-track": { color: "primary.main" },
                    "& .MuiSlider-rail": { color: "grey.600" },
                  }}
                />
              </Stack>

              {/* Right Controls */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Tooltip
                  title={`Skip Inactive: ${
                    playerState.skipInactive ? "ON" : "OFF"
                  }`}
                >
                  <ToggleButton
                    value="skipInactive"
                    selected={playerState.skipInactive}
                    onChange={handleSkipInactive}
                    size="small"
                    sx={{
                      color: "white",
                      "&.Mui-selected": {
                        bgcolor: "success.main",
                        color: "white",
                        "&:hover": { bgcolor: "success.dark" },
                      },
                    }}
                  >
                    <Tune fontSize="small" />
                  </ToggleButton>
                </Tooltip>

                <Tooltip
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  <IconButton
                    onClick={toggleFullscreen}
                    sx={{ color: "white" }}
                  >
                    {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* Progress Section */}
            <Stack spacing={1}>
              {/* Time Display */}
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="body2" color="grey.400">
                  {formatTime(playerState.currentTime)}
                </Typography>

                {isLive && (
                  <Chip
                    label="LIVE"
                    size="small"
                    color="error"
                    sx={{
                      fontWeight: "bold",
                      animation: "pulse 2s infinite",
                      "@keyframes pulse": {
                        "0%": { opacity: 1 },
                        "50%": { opacity: 0.7 },
                        "100%": { opacity: 1 },
                      },
                    }}
                  />
                )}

                <Typography variant="body2" color="grey.400">
                  {formatTime(playerState.totalTime)}
                </Typography>
              </Stack>

              {/* Progress Bar */}
              <Box sx={{ position: "relative" }}>
                <Slider
                  value={playerState.currentTime || 0}
                  onChange={handleSeek}
                  min={0}
                  max={playerState.totalTime || 1000}
                  step={100} // 100ms steps to prevent too frequent updates
                  disabled={!playerRef.current || playerState.totalTime <= 0}
                  sx={{
                    height: 8,
                    color: "primary.main",
                    "& .MuiSlider-thumb": {
                      width: 16,
                      height: 16,
                      "&:hover": {
                        boxShadow: "0px 0px 0px 8px rgba(25, 118, 210, 0.16)",
                      },
                      "&.Mui-focusVisible": {
                        boxShadow: "0px 0px 0px 8px rgba(25, 118, 210, 0.16)",
                      },
                    },
                    "& .MuiSlider-track": {
                      height: 8,
                      border: "none",
                    },
                    "& .MuiSlider-rail": {
                      height: 8,
                      backgroundColor: "grey.700",
                    },
                  }}
                />
              </Box>
            </Stack>
          </Box>
        )}
      </Stack>
    </Stack>
  );
};

export default CustomPlayer;
