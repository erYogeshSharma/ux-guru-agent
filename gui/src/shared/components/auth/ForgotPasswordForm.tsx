import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  CircularProgress,
  Container,
  IconButton,
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { useForgotPasswordMutation } from "@/app/services/auth.service";
import { useNavigate } from "react-router-dom";

const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const navigate = useNavigate();

  const validateEmail = (email: string) => {
    if (!email) {
      return "Email is required";
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return "Email is invalid";
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }

    try {
      const result = await forgotPassword({ email }).unwrap();
      if (result.success) {
        setSuccessMessage(result.message);
        setEmailError("");
      }
    } catch (err: unknown) {
      const errorMessage =
        err &&
        typeof err === "object" &&
        "data" in err &&
        err.data &&
        typeof err.data === "object" &&
        "message" in err.data
          ? String(err.data.message)
          : "An error occurred. Please try again.";
      setEmailError(errorMessage);
      setSuccessMessage("");
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) {
      setEmailError("");
    }
    if (successMessage) {
      setSuccessMessage("");
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          py: 3,
        }}
      >
        <Card
          sx={{
            width: "100%",
            maxWidth: 400,
            p: 2,
            boxShadow: (theme) => theme.shadows[10],
          }}
        >
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <IconButton
                onClick={() => navigate("/login")}
                sx={{ mr: 1 }}
                disabled={isLoading}
              >
                <ArrowBack />
              </IconButton>
              <Typography
                component="h1"
                variant="h5"
                sx={{ fontWeight: "bold", color: "primary.main" }}
              >
                Forgot Password
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your email address and we'll send you a link to reset your
              password.
            </Typography>

            {successMessage && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {successMessage}
              </Alert>
            )}

            {emailError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {emailError}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={handleEmailChange}
                error={!!emailError}
                disabled={isLoading}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2, py: 1.5 }}
                disabled={isLoading || !!successMessage}
              >
                {isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Send Reset Link"
                )}
              </Button>

              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  Remember your password?{" "}
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={() => navigate("/login")}
                    disabled={isLoading}
                  >
                    Sign in
                  </Link>
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default ForgotPasswordForm;
