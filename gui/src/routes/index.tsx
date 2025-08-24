import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";
import DashboardPage from "@/pages/dashboard/Dashboard";
import AuthenticationPage from "@/pages/auth/AuthPage";
import NotFoundPage from "@/pages/error/NotFoundPage";
import { useAuth } from "@/shared/hooks/userAuth";
import DashboardLayout from "@/shared/layout/DashboardWrapper";
import SessionsListingPage from "@/pages/sessions/SessionsListingPage";
import SessionDetailsPage from "@/pages/session-details/SessionDetailsPage";

const PublicRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" /> : <Outlet />;
};

const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

export function Router() {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <Navigate to="/dashboard" replace />,
    },
    {
      path: "/",
      element: <PublicRoute />,
      children: [
        { path: "login", element: <AuthenticationPage /> },
        { path: "signup", element: <AuthenticationPage /> },
        { path: "forgot-password", element: <AuthenticationPage /> },
        { path: "reset-password", element: <AuthenticationPage /> },
      ],
    },
    {
      path: "/",
      element: <ProtectedRoute />,
      children: [
        {
          path: "dashboard",
          element: (
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          ),
        },
        {
          path: "session/history",
          element: (
            <DashboardLayout>
              <SessionsListingPage />
            </DashboardLayout>
          ),
        },
        {
          path: "session/:session-id",
          element: (
            <DashboardLayout>
              <SessionDetailsPage />
            </DashboardLayout>
          ),
        },
      ],
    },
    // Catch-all route for 404 Not Found
    {
      path: "*",
      element: <NotFoundPage />,
    },
  ]);
  return <RouterProvider router={router} />;
}
