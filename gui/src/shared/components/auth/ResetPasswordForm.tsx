import React, { useState, useEffect } from "react";
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
import { useResetPasswordMutation } from "@/app/services/auth.service";
import { useNavigate, useSearchParams } from "react-router-dom";

const ResetPasswordForm: React.FC = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");

  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [resetPassword, { isLoading }] = useResetPasswordMutation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !token) {
      return;
    }

    try {
      const result = await resetPassword({
        token,
        newPassword: password,
      }).unwrap();

      if (result.success) {
        setSuccessMessage(result.message);
        setFormErrors({});

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate("/login");
        }, 3000);
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
      setFormErrors({ general: errorMessage });
      setSuccessMessage("");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "password") {
      setPassword(value);
    } else if (name === "confirmPassword") {
      setConfirmPassword(value);
    }

    // Clear field error when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }

    // Clear general error
    if (formErrors.general) {
      setFormErrors((prev) => ({ ...prev, general: "" }));
    }
  };

  if (!token) {
    return null;
  }

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
                Reset Password
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your new password below.
            </Typography>

            {successMessage && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {successMessage}
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Redirecting to login page...
                </Typography>
              </Alert>
            )}

            {formErrors.general && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formErrors.general}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="New Password"
                type="password"
                id="password"
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={handleInputChange}
                error={!!formErrors.password}
                helperText={formErrors.password}
                disabled={isLoading || !!successMessage}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                name="confirmPassword"
                label="Confirm New Password"
                type="password"
                id="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={handleInputChange}
                error={!!formErrors.confirmPassword}
                helperText={formErrors.confirmPassword}
                disabled={isLoading || !!successMessage}
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
                  "Reset Password"
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

export default ResetPasswordForm;
