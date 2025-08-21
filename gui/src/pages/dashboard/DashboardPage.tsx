import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/routes/config";
import { apiClient } from "@/api/client";
import type { ServerStats } from "@/api/client";

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, isAdmin, isManager } = useAuth();
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    loadServerStats();
  }, []);

  const loadServerStats = async () => {
    try {
      setLoadingStats(true);
      setStatsError(null);
      const serverStats = await apiClient.getStats();
      setStats(serverStats);
    } catch (error) {
      console.error("Failed to load server stats:", error);
      setStatsError("Failed to load server statistics");
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate({ to: ROUTES.AUTH });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "error";
      case "manager":
        return "warning";
      default:
        return "primary";
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* User Information */}
      {user && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Welcome back, {user.name}!
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Email: {user.email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Organization: {user.organization.companyName}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2" color="text.secondary">
                    Role:
                  </Typography>
                  <Chip
                    label={user.role.toUpperCase()}
                    size="small"
                    color={
                      getRoleColor(user.role) as "primary" | "warning" | "error"
                    }
                  />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Server Statistics */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Server Statistics
          </Typography>

          {loadingStats ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress />
            </Box>
          ) : statsError ? (
            <Alert severity="error">{statsError}</Alert>
          ) : stats ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="h4" color="primary">
                  {stats.totalClients}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Clients
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="h4" color="success.main">
                  {stats.activeSessions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Sessions
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="h4" color="info.main">
                  {stats.totalEvents}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Events
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="h4" color="warning.main">
                  {Math.round(stats.uptime / 1000 / 60)}m
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Uptime
                </Typography>
              </Grid>
            </Grid>
          ) : null}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box display="flex" gap={2} flexWrap="wrap">
        <Button
          variant="contained"
          onClick={() => navigate({ to: ROUTES.SESSIONS })}
        >
          View Sessions
        </Button>

        {(isManager() || isAdmin()) && (
          <Button
            variant="outlined"
            onClick={() => navigate({ to: ROUTES.SESSIONS })}
          >
            Manage Sessions
          </Button>
        )}

        {isAdmin() && (
          <Button
            variant="outlined"
            color="warning"
            onClick={() => {
              // TODO: Implement user management page
              console.log("Navigate to user management");
            }}
          >
            Manage Users
          </Button>
        )}

        <Button
          variant="outlined"
          color="error"
          onClick={handleSignOut}
          sx={{ ml: "auto" }}
        >
          Sign Out
        </Button>
      </Box>
    </Box>
  );
};

export default DashboardPage;
