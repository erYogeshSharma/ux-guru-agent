import React from "react";
import { RouterProvider } from '@tanstack/react-router'
import { router } from '@/routes'
import { AuthProvider } from '@/contexts/AuthContext'

/**
 * Main App Component - Updated with TanStack Router
 *
 * This component serves as the main entry point and sets up routing for the application.
 * The routing handles authentication, dashboard, sessions, and player views.
 */

const App: React.FC = () => {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
};

export default App;
