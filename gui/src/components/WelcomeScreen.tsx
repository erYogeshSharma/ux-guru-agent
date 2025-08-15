import React from "react";
import {
  Box,
  Container,
  Typography,
  Stack,
  Card,
  CardContent,
} from "@mui/material";
import {
  Visibility,
  FiberManualRecord,
  Search,
  PlayArrow,
} from "@mui/icons-material";
import type { WelcomeScreenProps } from "../types";

const WelcomeScreen: React.FC<WelcomeScreenProps> = () => {
  return (
    <Container maxWidth="md" sx={{ py: 8, textAlign: "center" }}>
      <Stack spacing={4} alignItems="center">
        <Visibility sx={{ fontSize: 80, color: "primary.main" }} />

        <Typography variant="h4" component="h1" gutterBottom>
          Select a session to start watching
        </Typography>

        <Typography variant="body1" color="text.secondary" paragraph>
          Choose an active session from the sidebar to view the live replay.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 3,
            mt: 4,
          }}
        >
          <Card elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
            <CardContent sx={{ textAlign: "center" }}>
              <FiberManualRecord
                sx={{ fontSize: 40, color: "success.main", mb: 2 }}
              />
              <Typography variant="h6" gutterBottom>
                Real-time Replay
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Watch user interactions as they happen in real-time
              </Typography>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
            <CardContent sx={{ textAlign: "center" }}>
              <Search sx={{ fontSize: 40, color: "primary.main", mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Session Search
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Find specific sessions by user ID or URL
              </Typography>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
            <CardContent sx={{ textAlign: "center" }}>
              <PlayArrow
                sx={{ fontSize: 40, color: "secondary.main", mb: 2 }}
              />
              <Typography variant="h6" gutterBottom>
                Playback Controls
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Play, pause, and adjust speed for recorded sessions
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Stack>
    </Container>
  );
};

export default WelcomeScreen;
