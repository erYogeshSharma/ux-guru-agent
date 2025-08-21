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
import type { SignupFormData, FormErrors } from "@/types/auth";

interface SignupFormProps {
  onSwitchToSignin: () => void;
  onSuccess?: () => void;
}

const SignupForm: React.FC<SignupFormProps> = ({
  onSwitchToSignin,
  onSuccess,
}) => {
  const { signup, isLoading, error, clearError } = useAuth();
  const [formData, setFormData] = useState<SignupFormData>({
    name: "",
    email: "",
    companyName: "",
    password: "",
    confirmPassword: "",
    website: "",
    description: "",
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.name) {
      errors.name = "Name is required";
    }

    if (!formData.email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Email is invalid";
    }

    if (!formData.companyName) {
      errors.companyName = "Company name is required";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange =
    (field: keyof SignupFormData) =>
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
      await signup({
        name: formData.name,
        email: formData.email,
        companyName: formData.companyName,
        password: formData.password,
        website: formData.website || undefined,
        description: formData.description || undefined,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // Error is handled by the auth store
      console.error("Signup error:", err);
    }
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 500, width: "100%", mx: "auto" }}>
      <Typography variant="h4" gutterBottom align="center">
        Create Account
      </Typography>
      <Typography
        variant="body2"
        sx={{ mb: 3 }}
        align="center"
        color="text.secondary"
      >
        Sign up to start tracking user sessions
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Full Name"
          value={formData.name}
          onChange={handleChange("name")}
          error={!!formErrors.name}
          helperText={formErrors.name}
          margin="normal"
          disabled={isLoading}
          autoComplete="name"
        />

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
          label="Company Name"
          value={formData.companyName}
          onChange={handleChange("companyName")}
          error={!!formErrors.companyName}
          helperText={formErrors.companyName}
          margin="normal"
          disabled={isLoading}
          autoComplete="organization"
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
          autoComplete="new-password"
        />

        <TextField
          fullWidth
          label="Confirm Password"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange("confirmPassword")}
          error={!!formErrors.confirmPassword}
          helperText={formErrors.confirmPassword}
          margin="normal"
          disabled={isLoading}
          autoComplete="new-password"
        />

        <TextField
          fullWidth
          label="Website (Optional)"
          value={formData.website}
          onChange={handleChange("website")}
          error={!!formErrors.website}
          helperText={formErrors.website}
          margin="normal"
          disabled={isLoading}
          autoComplete="url"
        />

        <TextField
          fullWidth
          label="Description (Optional)"
          multiline
          rows={3}
          value={formData.description}
          onChange={handleChange("description")}
          error={!!formErrors.description}
          helperText={formErrors.description}
          margin="normal"
          disabled={isLoading}
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
            "Create Account"
          )}
        </Button>

        <Box sx={{ textAlign: "center" }}>
          <Typography variant="body2">
            Already have an account?{" "}
            <Link
              component="button"
              type="button"
              onClick={onSwitchToSignin}
              underline="hover"
              disabled={isLoading}
            >
              Sign in
            </Link>
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default SignupForm;
