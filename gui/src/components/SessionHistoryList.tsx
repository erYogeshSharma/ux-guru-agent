/**
 * Session History List Component
 * Displays sessions from database with filtering and pagination
 */

import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemButton,
  Paper,
  Stack,
  Avatar,
  Chip,
  FormControlLabel,
  Checkbox,
  Drawer,
  IconButton,
  Alert,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Pagination,
} from "@mui/material";
import {
  Search,
  Person,
  Event,
  Error as ErrorIcon,
  Schedule,
  Language,
  FiberManualRecord,
  ArrowLeftOutlined,
  Refresh,
  History,
  PlayArrow,
} from "@mui/icons-material";
import {
  useActiveSessionsQuery,
  useSessionHistoryQuery,
  type ApiSession,
} from "../api";
import type { Session } from "../types";

interface SessionHistoryListProps {
  selectedSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  formatTime: (timestamp: number) => string;
  formatDuration: (startTime: number, lastActivity: number) => string;
}

// Convert API session format to internal session format
const convertApiSessionToSession = (apiSession: ApiSession): Session => {
  const meta = apiSession.metadata || ({} as ApiSession["metadata"]);
  const m = meta as Record<string, unknown>;

  // Some backends send `timestamp` instead of `startTime`.
  // Also accept createdAt/updatedAt ISO strings as fallbacks.
  const rawStartVal = m["startTime"] ?? m["timestamp"] ?? apiSession.createdAt;
  const rawLastVal =
    m["lastActivity"] ??
    m["last_activity"] ??
    apiSession.updatedAt ??
    rawStartVal;

  const parseTime = (v: unknown, fallback = 0) => {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string") {
      const parsed = Date.parse(v);
      if (!Number.isNaN(parsed)) return parsed;
      const asNum = Number(v);
      if (!Number.isNaN(asNum)) return asNum;
    }
    return fallback;
  };

  const startTime = parseTime(rawStartVal, 0);
  const lastActivity = parseTime(rawLastVal, startTime || 0);

  const vp = m["viewport"];
  let viewport = { width: 1920, height: 1080, devicePixelRatio: 1 };
  if (vp && typeof vp === "object") {
    const vpr = vp as Record<string, unknown>;
    const w = vpr["width"] ?? vpr["w"];
    const h = vpr["height"] ?? vpr["h"];
    const dpr = vpr["devicePixelRatio"] ?? vpr["dpr"];
    viewport = {
      width: typeof w === "number" ? w : w ? Number(w) || 1920 : 1920,
      height: typeof h === "number" ? h : h ? Number(h) || 1080 : 1080,
      devicePixelRatio:
        typeof dpr === "number" ? dpr : dpr ? Number(dpr) || 1 : 1,
    };
  }

  return {
    sessionId: apiSession.sessionId ?? (m["sessionId"] as string) ?? "",
    userId: apiSession.userId ?? (m["userId"] as string) ?? "unknown",
    metadata: {
      url:
        (typeof m["url"] === "string" && m["url"]) ||
        (typeof m["href"] === "string" && m["href"]) ||
        (typeof m["referrer"] === "string" && m["referrer"]) ||
        "",
      userAgent:
        typeof m["userAgent"] === "string" ? (m["userAgent"] as string) : "",
      startTime: Number(startTime) || 0,
      lastActivity: Number(lastActivity) || Number(startTime) || 0,
      viewport,
      referrer:
        typeof m["referrer"] === "string" ? (m["referrer"] as string) : "",
      timeZone:
        typeof m["timeZone"] === "string" ? (m["timeZone"] as string) : "UTC",
    },
    eventCount: apiSession.eventCount ?? 0,
    errorCount: apiSession.errorCount ?? 0,
  };
};

export const SessionHistoryList: React.FC<SessionHistoryListProps> = ({
  selectedSessionId,
  onSessionSelect,
  formatTime,
  formatDuration,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionType, setSessionType] = useState<"active" | "history">(
    "active"
  );
  const [page, setPage] = useState(1);
  const [filterActive, setFilterActive] = useState(true);

  const itemsPerPage = 20;
  const offset = (page - 1) * itemsPerPage;

  // Query active sessions
  const {
    data: apiActiveSessions = [],
    isLoading: isLoadingActive,
    isError: isErrorActive,
    error: errorActive,
    refetch: refetchActive,
  } = useActiveSessionsQuery();

  // Query session history
  const {
    data: historyData,
    isLoading: isLoadingHistory,
    isError: isErrorHistory,
    error: errorHistory,
    refetch: refetchHistory,
  } = useSessionHistoryQuery(itemsPerPage, offset, sessionType === "history");

  const apiHistorySessions = useMemo(() => {
    return historyData?.sessions || [];
  }, [historyData?.sessions]);

  // Convert API sessions to internal format
  const activeSessions = useMemo(
    () => apiActiveSessions.map(convertApiSessionToSession),
    [apiActiveSessions]
  );

  const historySessions = useMemo(
    () => apiHistorySessions.map(convertApiSessionToSession),
    [apiHistorySessions]
  );

  // Current sessions based on toggle
  const currentSessions =
    sessionType === "active" ? activeSessions : historySessions;
  const isLoading =
    sessionType === "active" ? isLoadingActive : isLoadingHistory;
  const isError = sessionType === "active" ? isErrorActive : isErrorHistory;
  const error = sessionType === "active" ? errorActive : errorHistory;
  const refetch = sessionType === "active" ? refetchActive : refetchHistory;

  // Filter sessions based on search and active filter
  const filteredSessions = useMemo(() => {
    return currentSessions.filter((session) => {
      const matchesSearch =
        searchQuery === "" ||
        session.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.metadata.url.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesActiveFilter =
        !filterActive ||
        sessionType === "active" || // All active sessions are active by definition
        session.metadata.lastActivity > Date.now() - 300000; // 5 minutes for history

      return matchesSearch && matchesActiveFilter;
    });
  }, [currentSessions, searchQuery, filterActive, sessionType]);

  const handleSessionTypeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newType: "active" | "history" | null
  ) => {
    if (newType !== null) {
      setSessionType(newType);
      setPage(1); // Reset to first page when switching
    }
  };

  const totalPages =
    sessionType === "history"
      ? Math.ceil((historyData?.sessions.length || 0) / itemsPerPage)
      : 1; // Active sessions don't need pagination

  return (
    <Stack>
      <IconButton
        sx={{
          position: "absolute",
          top: 50,
          backgroundColor: "background.paper",
          left: open ? 400 : 20,
          zIndex: 1300,
          transition: "left 0.3s ease",
        }}
        onClick={() => setOpen(!open)}
      >
        <ArrowLeftOutlined
          sx={{
            transform: open ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform 0.3s ease",
          }}
        />
      </IconButton>

      <Drawer
        variant="temporary"
        anchor="left"
        open={open}
        sx={{
          width: 420,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: 420,
            boxSizing: "border-box",
            top: 0,
            height: "100vh",
          },
        }}
      >
        <Paper sx={{ height: "100%", borderRadius: 0 }}>
          <Stack spacing={2} sx={{ p: 2, height: "100%" }}>
            {/* Header */}
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="h6">
                Sessions ({filteredSessions.length})
              </Typography>
              <Box display="flex" gap={1}>
                <IconButton size="small" onClick={() => refetch()}>
                  <Refresh />
                </IconButton>
              </Box>
            </Box>

            {/* Session Type Toggle */}
            <ToggleButtonGroup
              value={sessionType}
              exclusive
              onChange={handleSessionTypeChange}
              size="small"
              fullWidth
            >
              <ToggleButton value="active">
                <PlayArrow sx={{ mr: 1 }} />
                Active
              </ToggleButton>
              <ToggleButton value="history">
                <History sx={{ mr: 1 }} />
                History
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Search */}
            <TextField
              fullWidth
              size="small"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <Search sx={{ mr: 1, color: "text.secondary" }} />
                ),
              }}
            />

            {/* Filters */}
            {sessionType === "history" && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={filterActive}
                    onChange={(e) => setFilterActive(e.target.checked)}
                    size="small"
                  />
                }
                label="Show only recently active"
              />
            )}

            {/* Loading State */}
            {isLoading && (
              <Box display="flex" justifyContent="center" py={2}>
                <CircularProgress size={24} />
              </Box>
            )}

            {/* Error State */}
            {isError && (
              <Alert severity="error">
                Failed to load sessions: {error?.message}
              </Alert>
            )}

            {/* Sessions List */}
            <Box sx={{ flex: 1, overflow: "auto" }}>
              {filteredSessions.length === 0 && !isLoading ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                  sx={{ mt: 4 }}
                >
                  No sessions found
                </Typography>
              ) : (
                <List disablePadding>
                  {filteredSessions.map((session) => {
                    const isSelected = selectedSessionId === session.sessionId;
                    const isActive =
                      sessionType === "active" ||
                      session.metadata.lastActivity > Date.now() - 300000;
                    // Use userId fallback to sessionId for display
                    return (
                      <ListItem key={session.sessionId} disablePadding>
                        <ListItemButton
                          selected={isSelected}
                          onClick={() => onSessionSelect(session.sessionId)}
                          sx={{
                            borderRadius: 1,
                            mb: 1,
                            border: isSelected ? "2px solid" : "1px solid",
                            borderColor: isSelected
                              ? "primary.main"
                              : "divider",
                          }}
                        >
                          <Stack spacing={1} sx={{ width: "100%" }}>
                            {/* Session Header */}
                            <Box display="flex" alignItems="center" gap={1}>
                              <Avatar sx={{ width: 28, height: 28 }}>
                                <Person fontSize="small" />
                              </Avatar>
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  flex: 1,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {session.userId || session.sessionId}
                              </Typography>
                              {isActive && (
                                <FiberManualRecord
                                  sx={{ fontSize: 12, color: "success.main" }}
                                />
                              )}
                            </Box>

                            {/* URL */}
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <Language
                                sx={{ fontSize: 14, color: "text.secondary" }}
                              />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {session.metadata.url ||
                                  session.metadata.referrer ||
                                  "(no url)"}
                              </Typography>
                            </Box>

                            {/* Stats */}
                            <Box display="flex" gap={1} flexWrap="wrap">
                              <Chip
                                size="small"
                                variant="outlined"
                                icon={<Event sx={{ fontSize: 14 }} />}
                                label={session.eventCount}
                              />
                              {session.errorCount > 0 && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  icon={<ErrorIcon sx={{ fontSize: 14 }} />}
                                  label={session.errorCount}
                                />
                              )}
                              <Chip
                                size="small"
                                variant="outlined"
                                icon={<Schedule sx={{ fontSize: 14 }} />}
                                label={formatDuration(
                                  session.metadata.startTime,
                                  session.metadata.lastActivity
                                )}
                              />
                            </Box>

                            {/* Timestamp */}
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Started: {formatTime(session.metadata.startTime)}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Last Activity:{" "}
                              {formatTime(session.metadata.lastActivity)}
                            </Typography>
                          </Stack>
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Box>

            {/* Pagination for history */}
            {sessionType === "history" && totalPages > 1 && (
              <Box display="flex" justifyContent="center" mt={2}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_event, value) => setPage(value)}
                  size="small"
                />
              </Box>
            )}
          </Stack>
        </Paper>
      </Drawer>
    </Stack>
  );
};

export default SessionHistoryList;
