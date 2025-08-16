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
  const eventsRef = useRef<eventWithTime[]>([]); // Store events in ref to avoid dependency issues

  // Use our custom hook
  const { playerState, isLive } = useSessionReplayStore();

  // Update events ref when events change
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // Effect to handle player initialization
  useEffect(() => {
    const currentEvents = eventsRef.current;

    // Always reinitialize when events change (except for empty events)
    if (
      initializingRef.current ||
      !containerRef.current ||
      currentEvents.length === 0
    ) {
      return;
    }

    // Clean up existing player before creating new one
    if (playerRef.current) {
      playerRef.current = null;
    }

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

        // Use requestAnimationFrame to defer store updates and break the update loop
        requestAnimationFrame(() => {
          // Set up event listeners for player state updates
          player.addEventListener("ui-update-current-time", (event) => {
            // Use setTimeout to defer store updates
            setTimeout(() => {
              sessionReplayActions.updatePlayerState({
                currentTime: event.payload as number,
              });
            }, 0);
          });

          player.addEventListener("ui-update-player-state", (event) => {
            const state = event.payload as string;
            setTimeout(() => {
              sessionReplayActions.updatePlayerState({
                isPlaying: state === "playing",
              });
            }, 0);
          });

          player.addEventListener("ui-update-progress", (event) => {
            const progress = event.payload as number;
            setTimeout(() => {
              sessionReplayActions.updatePlayerState({
                progress,
              });
            }, 0);
          });

          // Calculate total time from events and update store
          if (latestEvents.length > 1) {
            const totalTime =
              latestEvents[latestEvents.length - 1].timestamp -
              latestEvents[0].timestamp;
            setTimeout(() => {
              sessionReplayActions.updatePlayerState({ totalTime });
            }, 0);
          }

          // Update store with player instance
          setTimeout(() => {
            sessionReplayActions.setPlayerInstance(player);
          }, 0);
        });

        // Store player instance in ref
        playerRef.current = player;
        lastEventCountRef.current = latestEvents.length;

        console.log("Player initialized with", latestEvents.length, "events");

        // Auto-play if specified and this is a live session
        if (autoPlay && isLive) {
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
  }, [events.length, width, height, autoPlay, showController, isLive]); // Now we can depend on events.length safely

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playerRef.current = null;
      sessionReplayActions.setPlayerInstance(null);
    };
  }, []); // Empty dependency array - only run on unmount

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
    if (playerRef.current && !isNaN(time)) {
      playerRef.current.goto(time);
      // Update store immediately for responsive UI
      sessionReplayActions.updatePlayerState({ currentTime: time });
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

  const formatTime = (timeInMs: number) => {
    const seconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(
        seconds % 60
      )
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
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
            width: "100%",
            maxWidth: `${width}px`,
            aspectRatio: `${width}/${height}`,
            bgcolor: "black",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            borderRadius: 1,
            boxShadow: 1,
          }}
        />

        {/* Custom MUI Controls */}
        {!showController && playerRef.current && (
          <Box>
            {/* Top Controls Row */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              mb={2}
            >
              {/* Play Controls */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Tooltip title={playerState.isPlaying ? "Pause" : "Play"}>
                  <IconButton
                    onClick={handlePlayPause}
                    sx={{ color: "primary.main" }}
                    size="large"
                  >
                    {playerState.isPlaying ? <Pause /> : <PlayArrow />}
                  </IconButton>
                </Tooltip>

                <Tooltip title="Skip to start">
                  <IconButton
                    onClick={() => playerRef.current?.goto(0)}
                    sx={{ color: "white" }}
                  >
                    <FastRewind />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Skip to end">
                  <IconButton
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
                    { value: 0.5, label: "0.5x" },
                    { value: 1, label: "1x" },
                    { value: 2, label: "2x" },
                    { value: 4, label: "4x" },
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
                  value={playerState.currentTime}
                  onChange={handleSeek}
                  min={0}
                  max={playerState.totalTime}
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
