import React, { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  CircularProgress,
  Link,
} from "@mui/material";
import { useAuth } from "@/contexts/AuthContext";
import type { SigninFormData, FormErrors } from "@/types/auth";

interface SigninFormProps {
  onSwitchToSignup: () => void;
  onSuccess?: () => void;
}

const SigninForm: React.FC<SigninFormProps> = ({
  onSwitchToSignup,
  onSuccess,
}) => {
  const { signin, isLoading, error, clearError } = useAuth();
  const [formData, setFormData] = useState<SigninFormData>({
    email: "",
    password: "",
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

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

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange =
    (field: keyof SigninFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData({ ...formData, [field]: e.target.value });
      if (formErrors[field]) {
        setFormErrors({ ...formErrors, [field]: "" });
      }
      if (error) {
        clearError();
      }
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await signin({
        email: formData.email,
        password: formData.password,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // Error is handled by the auth store
      console.error("Signin error:", err);
    }
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 400, width: "100%", mx: "auto" }}>
      <Typography variant="h4" gutterBottom align="center">
        Sign In
      </Typography>
      <Typography
        variant="body2"
        sx={{ mb: 3 }}
        align="center"
        color="text.secondary"
      >
        Welcome back! Please sign in to your account.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Email"
          type="email"
          value={formData.email}
          onChange={handleChange("email")}
          error={!!formErrors.email}
          helperText={formErrors.email}
          margin="normal"
          disabled={isLoading}
          autoComplete="email"
        />

        <TextField
          fullWidth
          label="Password"
          type="password"
          value={formData.password}
          onChange={handleChange("password")}
          error={!!formErrors.password}
          helperText={formErrors.password}
          margin="normal"
          disabled={isLoading}
          autoComplete="current-password"
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={isLoading}
          sx={{ mt: 3, mb: 2 }}
        >
          {isLoading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            "Sign In"
          )}
        </Button>

        <Box sx={{ textAlign: "center" }}>
          <Typography variant="body2">
            Don't have an account?{" "}
            <Link
              component="button"
              type="button"
              onClick={onSwitchToSignup}
              underline="hover"
              disabled={isLoading}
            >
              Sign up
            </Link>
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default SigninForm;
