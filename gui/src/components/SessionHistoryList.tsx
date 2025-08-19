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
import { useSessionManager } from "../hooks/useSessionManager";
import type { Session } from "../types";

interface SessionHistoryListProps {
  selectedSessionId: string | null;
  onSessionSelect: (sessionId: string, sessionData?: Session) => void;
  formatTime: (timestamp: number) => string;
  formatDuration: (startTime: number, lastActivity: number) => string;
  // Optional sessions provided by WebSocket (real-time). If present and
  // `sessionType === 'active'` this will be preferred over the REST query
  // results so the UI streams active sessions.
  wsActiveSessions?: Session[];
}

export const SessionHistoryList: React.FC<SessionHistoryListProps> = ({
  selectedSessionId,
  onSessionSelect,
  formatTime,
  formatDuration,
  wsActiveSessions,
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

  // Use centralized session manager
  const sessionManager = useSessionManager();

  // For backward compatibility, still use wsActiveSessions if provided
  // Otherwise use the centralized session manager
  const activeSessions = wsActiveSessions || sessionManager.activeSessions;

  // Current sessions based on toggle
  const currentSessions = useMemo(() => {
    if (sessionType === "active") {
      // Filter active sessions to only show truly active ones
      return activeSessions.filter((session: Session) => {
        const sessionStatus = sessionManager.getSessionStatus(
          session.sessionId
        );
        return sessionStatus.isActive || sessionStatus.isLive;
      });
    }
    const historySessions = sessionManager.historySessions || [];
    return historySessions.slice(offset, offset + itemsPerPage);
  }, [
    sessionType,
    activeSessions,
    sessionManager, // Add sessionManager as dependency for both historySessions and getSessionStatus
    offset,
    itemsPerPage,
  ]);

  const isLoading = sessionManager.isLoading;
  const isError = !!sessionManager.error;
  const error = sessionManager.error;
  const refetch = sessionManager.refreshSessions;

  // Debug logging can be enabled here if needed
  // console.log("SessionHistoryList - Current sessions:", currentSessions);
  // console.log("SessionHistoryList - Session type:", sessionType);

  // Filter sessions based on search and active filter
  const filteredSessions = useMemo(() => {
    return currentSessions.filter((session: Session) => {
      const matchesSearch =
        searchQuery === "" ||
        session.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.metadata.url.toLowerCase().includes(searchQuery.toLowerCase());

      // For "active" sessions, all are already filtered to be active
      // For "history" sessions, apply active filter if enabled
      const matchesActiveFilter =
        !filterActive ||
        sessionType === "active" || // All shown active sessions are active by definition
        sessionManager.getSessionStatus(session.sessionId).isActive ||
        sessionManager.getSessionStatus(session.sessionId).isLive;

      return matchesSearch && matchesActiveFilter;
    });
  }, [currentSessions, searchQuery, filterActive, sessionType, sessionManager]);

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
      ? Math.ceil((sessionManager.historySessions?.length || 0) / itemsPerPage)
      : 1; // Active sessions don't need pagination

  return (
    <Stack>
      <IconButton
        sx={{
          position: "absolute",
          top: 50,
          backgroundColor: "primary.main",
          left: open ? 400 : 20,
          zIndex: 1300,
          transition: "left 0.3s ease",
          "&:hover": {
            backgroundColor: "primary.dark",
          },
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
        onClose={() => setOpen(false)}
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
              <Alert severity="error">Failed to load sessions: {error}</Alert>
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
                  {filteredSessions.map((session: Session) => {
                    const isSelected = selectedSessionId === session.sessionId;
                    const sessionStatus = sessionManager.getSessionStatus(
                      session.sessionId
                    );
                    const isActive = sessionStatus.isActive;
                    const isLive = sessionStatus.isLive;
                    // Use userId fallback to sessionId for display
                    return (
                      <ListItem key={session.sessionId} disablePadding>
                        <ListItemButton
                          selected={isSelected}
                          onClick={() =>
                            onSessionSelect(session.sessionId, session)
                          }
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
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  spacing={0.5}
                                >
                                  <FiberManualRecord
                                    sx={{
                                      fontSize: 12,
                                      color: isLive
                                        ? "success.main"
                                        : "warning.main",
                                    }}
                                  />
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: isLive
                                        ? "success.main"
                                        : "warning.main",
                                      fontSize: "0.7rem",
                                    }}
                                  >
                                    {isLive ? "LIVE" : "ACTIVE"}
                                  </Typography>
                                </Stack>
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
