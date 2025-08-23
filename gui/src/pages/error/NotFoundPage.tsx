import React from "react";
import {
  Box,
  Typography,
  Button,
  Container,
  Paper,
  useTheme,
} from "@mui/material";
import { Home, ArrowBack, Search } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/hooks/userAuth";
import DashboardLayout from "@/shared/layout/DashboardWrapper";

const NotFoundContent: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { isAuthenticated } = useAuth();

  const handleGoHome = () => {
    navigate(isAuthenticated ? "/dashboard" : "/login");
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: isAuthenticated ? "70vh" : "100vh",
          textAlign: "center",
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 6,
            borderRadius: 4,
            backgroundColor: theme.palette.background.paper,
            maxWidth: 600,
            width: "100%",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
            }}
          >
            {/* 404 Number */}
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: "6rem", sm: "8rem", md: "10rem" },
                fontWeight: "bold",
                color: theme.palette.primary.main,
                textShadow: `2px 2px 4px ${theme.palette.grey[300]}`,
                lineHeight: 1,
              }}
            >
              404
            </Typography>

            {/* Search Icon */}
            <Search
              sx={{
                fontSize: 80,
                color: theme.palette.grey[400],
                mb: 2,
              }}
            />

            {/* Main Message */}
            <Typography
              variant="h4"
              sx={{
                fontWeight: 600,
                color: theme.palette.text.primary,
                mb: 1,
              }}
            >
              Page Not Found
            </Typography>

            {/* Description */}
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                maxWidth: 400,
                lineHeight: 1.6,
                mb: 3,
              }}
            >
              Oops! The page you're looking for doesn't exist. It might have
              been moved, deleted, or you entered the wrong URL.
            </Typography>

            {/* Action Buttons */}
            <Box
              sx={{
                display: "flex",
                gap: 2,
                flexDirection: { xs: "column", sm: "row" },
                width: { xs: "100%", sm: "auto" },
              }}
            >
              <Button
                variant="contained"
                size="large"
                startIcon={<Home />}
                onClick={handleGoHome}
                sx={{
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 600,
                }}
              >
                {isAuthenticated ? "Go to Dashboard" : "Go to Login"}
              </Button>

              <Button
                variant="outlined"
                size="large"
                startIcon={<ArrowBack />}
                onClick={handleGoBack}
                sx={{
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 600,
                }}
              >
                Go Back
              </Button>
            </Box>

            {/* Help Text */}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
              If you believe this is an error, please contact support.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

const NotFoundPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return (
      <DashboardLayout>
        <NotFoundContent />
      </DashboardLayout>
    );
  }

  return <NotFoundContent />;
};

export default NotFoundPage;
