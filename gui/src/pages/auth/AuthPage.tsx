import React, { useState } from "react";
import { Box } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/routes/config";
import SigninForm from "@/components/SigninForm";
import SignupForm from "@/components/SignupForm";

type AuthMode = "signin" | "signup";

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("signin");

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: ROUTES.DASHBOARD });
    }
  }, [isAuthenticated, navigate]);

  const handleAuthSuccess = () => {
    navigate({ to: ROUTES.DASHBOARD });
  };

  const switchToSignup = () => setAuthMode("signup");
  const switchToSignin = () => setAuthMode("signin");

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      {authMode === "signin" ? (
        <SigninForm
          onSwitchToSignup={switchToSignup}
          onSuccess={handleAuthSuccess}
        />
      ) : (
        <SignupForm
          onSwitchToSignin={switchToSignin}
          onSuccess={handleAuthSuccess}
        />
      )}
    </Box>
  );
};

export default AuthPage;
