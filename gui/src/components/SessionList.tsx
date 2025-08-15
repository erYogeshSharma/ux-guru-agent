import React from "react";
import {
  Box,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Paper,
  Stack,
  Avatar,
  Chip,
  FormControlLabel,
  Checkbox,
  Drawer,
  IconButton,
} from "@mui/material";
import {
  Search,
  Person,
  Event,
  Error as ErrorIcon,
  Schedule,
  Language,
  Smartphone,
  FiberManualRecord,
  ArrowLeftOutlined,
} from "@mui/icons-material";
import type { SessionListProps } from "../types";

const SessionList: React.FC<SessionListProps> = ({
  sessions,
  selectedSessionId,
  searchQuery,
  filterActive,
  onSessionSelect,
  onSearchChange,
  onFilterChange,
  formatTime,
  formatDuration,
}) => {
  const [open, setOpen] = React.useState(false);
  return (
    <Stack>
      <IconButton
        sx={{
          position: "absolute",
          top: 50,
          backgroundColor: "background.paper",
          borderRadius: "1px 20px 20px 0px",
          boxShadow: 1,
          width: 40,
          zIndex: 1000,
        }}
        onClick={() => setOpen(true)}
      >
        <ArrowLeftOutlined />
      </IconButton>
      <Drawer
        variant="temporary"
        anchor="left"
        open={open}
        onClose={() => setOpen(false)}
      >
        <Stack>
          <Paper
            elevation={0}
            sx={{
              width: 400,
              borderRight: 1,
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
              bgcolor: "background.paper",
            }}
          >
            {/* Search and Filters */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="h6" gutterBottom>
                Sessions ({sessions.length})
              </Typography>

              <TextField
                fullWidth
                size="small"
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <Search sx={{ mr: 1, color: "text.secondary" }} />
                  ),
                }}
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={filterActive}
                    onChange={(e) => onFilterChange(e.target.checked)}
                    size="small"
                  />
                }
                label="Active sessions only"
              />
            </Box>

            {/* Sessions List */}
            <List sx={{ flex: 1, overflow: "auto", p: 0 }}>
              {sessions.map((session) => (
                <ListItem key={session.sessionId} disablePadding>
                  <ListItemButton
                    selected={selectedSessionId === session.sessionId}
                    onClick={() => onSessionSelect(session.sessionId)}
                    sx={{
                      flexDirection: "column",
                      alignItems: "stretch",
                      py: 2,
                      borderBottom: 1,
                      borderColor: "divider",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        mb: 1,
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: "primary.main",
                          }}
                        >
                          <Person fontSize="small" />
                        </Avatar>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {session.userId}
                        </Typography>
                      </Box>
                      <Chip
                        icon={<FiberManualRecord sx={{ fontSize: 12 }} />}
                        label="LIVE"
                        color="success"
                        size="small"
                        variant="outlined"
                      />
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        width: "100%",
                      }}
                    >
                      {session.metadata.url}
                    </Typography>

                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                      <Chip
                        icon={<Event />}
                        label={`${session.eventCount} events`}
                        size="small"
                        variant="outlined"
                      />
                      {session.errorCount > 0 && (
                        <Chip
                          icon={<ErrorIcon />}
                          label={`${session.errorCount} errors`}
                          size="small"
                          color="error"
                          variant="outlined"
                        />
                      )}
                    </Stack>

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        fontSize: "0.75rem",
                        color: "text.secondary",
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <Schedule fontSize="inherit" />
                        {formatDuration(
                          session.metadata.startTime,
                          session.metadata.lastActivity
                        )}
                      </Box>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <Smartphone fontSize="inherit" />
                        {session.metadata.viewport.width}×
                        {session.metadata.viewport.height}
                      </Box>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <Language fontSize="inherit" />
                        {session.metadata.timeZone}
                      </Box>
                    </Box>

                    <Stack
                      sx={{
                        mt: 1,
                        fontSize: "0.7rem",
                        color: "text.secondary",
                      }}
                    >
                      <Typography variant="caption">
                        Started: {formatTime(session.metadata.startTime)}
                      </Typography>
                      <Typography variant="caption">
                        Last seen: {formatTime(session.metadata.lastActivity)}
                      </Typography>
                    </Stack>
                  </ListItemButton>
                </ListItem>
              ))}

              {sessions.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary={
                      searchQuery
                        ? "No sessions match your search"
                        : "No active sessions"
                    }
                    secondary="Sessions will appear here when users are active"
                    sx={{ textAlign: "center", py: 4 }}
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        </Stack>
      </Drawer>
    </Stack>
  );
};

export default SessionList;
