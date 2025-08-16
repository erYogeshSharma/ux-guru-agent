/**
 * ServerStats Component
 * Displays live server statistics and provides session management
 */

import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  Divider,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  Computer as ComputerIcon,
  Visibility as ViewIcon,
  RecordVoiceOver as TrackerIcon,
  Event as EventIcon,
  AccessTime as UptimeIcon,
  CleaningServices as CleanupIcon,
} from "@mui/icons-material";
import { useStatsQuery, useCleanupSessionsMutation } from "../api";

const formatUptime = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat().format(num);
};

export const ServerStats: React.FC = () => {
  const { data: stats, isLoading, isError, error } = useStatsQuery();
  const cleanupMutation = useCleanupSessionsMutation();

  const handleCleanup = () => {
    cleanupMutation.mutate(24); // Cleanup sessions older than 24 hours
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            py={4}
          >
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading server stats...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            Failed to load server stats: {error?.message || "Unknown error"}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Server Statistics
        </Typography>

        <Box
          display="flex"
          flexWrap="wrap"
          gap={2}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Box display="flex" alignItems="center" gap={1} flex="1 1 200px">
            <ComputerIcon color="primary" />
            <Box>
              <Typography variant="h6">
                {formatNumber(stats.totalClients)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Clients
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1} flex="1 1 200px">
            <ViewIcon color="secondary" />
            <Box>
              <Typography variant="h6">
                {formatNumber(stats.viewers)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Viewers
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1} flex="1 1 200px">
            <TrackerIcon color="success" />
            <Box>
              <Typography variant="h6">
                {formatNumber(stats.trackers)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Trackers
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1} flex="1 1 200px">
            <EventIcon color="info" />
            <Box>
              <Typography variant="h6">
                {formatNumber(stats.totalEvents)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Events
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <UptimeIcon color="action" />
            <Typography variant="body2" color="text.secondary">
              Uptime: {formatUptime(stats.uptime)}
            </Typography>
          </Box>

          <Box display="flex" gap={1} alignItems="center">
            <Chip
              label={`${formatNumber(stats.activeSessions)} Active Sessions`}
              color={stats.activeSessions > 0 ? "success" : "default"}
              size="small"
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<CleanupIcon />}
              onClick={handleCleanup}
              disabled={cleanupMutation.isPending}
            >
              {cleanupMutation.isPending ? "Cleaning..." : "Cleanup"}
            </Button>
          </Box>
        </Box>

        {cleanupMutation.isSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {cleanupMutation.data?.message}
          </Alert>
        )}

        {cleanupMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Cleanup failed: {cleanupMutation.error?.message}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default ServerStats;
