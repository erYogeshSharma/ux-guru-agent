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
  Divider,
  Container,
} from "@mui/material";
import {
  useSigninMutation,
  useSignupMutation,
} from "@/app/services/auth.service";
import { useAuth } from "@/shared/hooks/userAuth";
import { useNavigate, useLocation } from "react-router-dom";

type AuthMode = "signin" | "signup";

const AuthForm: React.FC = () => {
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>(() =>
    location.pathname === "/signup" ? "signup" : "signin"
  );

  // Update mode when location changes
  useEffect(() => {
    setMode(location.pathname === "/signup" ? "signup" : "signin");
  }, [location.pathname]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [signin, { isLoading: isSigninLoading }] = useSigninMutation();
  const [signup, { isLoading: isSignupLoading }] = useSignupMutation();
  const { error, clearError } = useAuth();

  
  const navigate = useNavigate();

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Email is invalid";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (mode === "signup") {
      if (!formData.name) {
        errors.name = "Name is required";
      }
      if (!formData.companyName) {
        errors.companyName = "Company name is required";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) {
      return;
    }

    try {
      if (mode === "signin") {
        const result = await signin({
          email: formData.email,
          password: formData.password,
        }).unwrap();
      
        console.log({ result });

        if (result.success) {
          navigate("/dashboard");
        }
      } else {
        const result = await signup({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          companyName: formData.companyName,
        }).unwrap();

        if (result.success) {
          navigate("/dashboard");
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear field error when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "signin" ? "signup" : "signin"));
    setFormErrors({});
    clearError();
  };

  const isLoading = isSigninLoading || isSignupLoading;

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
            <Typography
              component="h1"
              variant="h4"
              align="center"
              gutterBottom
              sx={{ fontWeight: "bold", color: "primary.main" }}
            >
              {mode === "signin" ? "Sign In" : "Sign Up"}
            </Typography>

            <Typography
              variant="body2"
              align="center"
              color="text.secondary"
              sx={{ mb: 3 }}
            >
              {mode === "signin"
                ? "Welcome back! Please sign in to your account."
                : "Create a new account to get started."}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              {mode === "signup" && (
                <>
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="name"
                    label="Full Name"
                    name="name"
                    autoComplete="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    error={!!formErrors.name}
                    helperText={formErrors.name}
                    disabled={isLoading}
                  />
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="companyName"
                    label="Company Name"
                    name="companyName"
                    autoComplete="organization"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    error={!!formErrors.companyName}
                    helperText={formErrors.companyName}
                    disabled={isLoading}
                  />
                </>
              )}

              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus={mode === "signin"}
                value={formData.email}
                onChange={handleInputChange}
                error={!!formErrors.email}
                helperText={formErrors.email}
                disabled={isLoading}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                value={formData.password}
                onChange={handleInputChange}
                error={!!formErrors.password}
                helperText={formErrors.password}
                disabled={isLoading}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2, py: 1.5 }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : mode === "signin" ? (
                  "Sign In"
                ) : (
                  "Sign Up"
                )}
              </Button>

              <Divider sx={{ my: 2 }} />

              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  {mode === "signin"
                    ? "Don't have an account? "
                    : "Already have an account? "}
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={toggleMode}
                    sx={{ ml: 0.5 }}
                    disabled={isLoading}
                  >
                    {mode === "signin" ? "Sign up" : "Sign in"}
                  </Link>
                </Typography>
              </Box>

              {mode === "signin" && (
                <Box textAlign="center" sx={{ mt: 1 }}>
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={() => navigate("/forgot-password")}
                    disabled={isLoading}
                  >
                    Forgot your password?
                  </Link>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default AuthForm;
