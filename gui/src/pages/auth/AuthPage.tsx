import { useLocation } from "react-router-dom";
import AuthForm from "@/shared/components/auth/AuthForm";
import ForgotPasswordForm from "@/shared/components/auth/ForgotPasswordForm";
import ResetPasswordForm from "@/shared/components/auth/ResetPasswordForm";

const AuthPage = () => {
  const location = useLocation();
  const pathname = location.pathname;

  if (pathname === "/login" || pathname === "/signup") {
    return <AuthForm />;
  }

  if (pathname === "/forgot-password") {
    return <ForgotPasswordForm />;
  }

  if (pathname === "/reset-password") {
    return <ResetPasswordForm />;
  }

  // Default fallback
  return <AuthForm />;
};

export default AuthPage;
