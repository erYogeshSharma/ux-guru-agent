# Authentication Implementation

This implementation provides a complete authentication system for the UX Guru application, integrating with the Fastify server backend.

## Features Implemented

### 1. API Client Architecture

- **Base API Client** (`src/api/baseClient.ts`): Extensible base class for HTTP requests
- **Endpoints Configuration** (`src/api/endpoints.ts`): Centralized endpoint definitions
- **Service-specific Clients**:
  - `AuthApiClient`: Authentication operations
  - `SessionApiClient`: Session management
  - `HealthApiClient`: Health checks and server stats
- **Main API Client** (`src/api/client.ts`): Unified client instance with token management

### 2. Authentication Store (TanStack Store)

- **Store**: `src/store/tanstackAuthStore.ts`
- **Features**:
  - Persistent authentication state in localStorage
  - Automatic token management
  - Role-based access control helpers
  - Error handling and loading states

### 3. Auth Context

- **Context**: `src/contexts/AuthContext.tsx`
- **Provides**:
  - Authentication state
  - Auth actions (signup, signin, logout)
  - Role checking utilities
  - User management functions

### 4. UI Components

- **SigninForm** (`src/components/SigninForm.tsx`): Complete signin form with validation
- **SignupForm** (`src/components/SignupForm.tsx`): User registration form
- **AuthPage** (`src/pages/auth/AuthPage.tsx`): Auth page with form switching
- **Enhanced Dashboard** (`src/pages/dashboard/DashboardPage.tsx`): User info and server stats

### 5. Protected Routes

- **ProtectedRoute** component ensures authentication before accessing protected pages
- Automatic redirection to auth page for unauthenticated users

## API Endpoints Supported

### Authentication

- `POST /auth/signup` - User registration
- `POST /auth/signin` - User login
- `GET /auth/me` - Get current user info
- `POST /auth/users` - Create user (admin/manager only)
- `GET /auth/users` - Get organization users (admin/manager only)

### Sessions

- `GET /sessions/active` - Get active sessions
- `GET /sessions` - Get all sessions with pagination
- `GET /sessions/:id/events` - Get session events
- `DELETE /sessions/cleanup` - Cleanup old sessions (admin only)

### Health & Stats

- `GET /health` - Health check
- `GET /stats` - Server statistics

## Environment Configuration

Create a `.env` file in the GUI directory:

```env
VITE_AUTH_SERVER_URL=http://localhost:8000
VITE_SESSION_SERVER_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

## Usage

### 1. Starting the App

The authentication system initializes automatically:

```tsx
// App.tsx
import { AuthProvider } from "@/contexts/AuthContext";

const App = () => {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
};
```

### 2. Using Auth in Components

```tsx
import { useAuth } from "@/contexts/AuthContext";

const MyComponent = () => {
  const { user, isAuthenticated, signin, logout, isAdmin, isManager } =
    useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/auth" />;
  }

  return (
    <div>
      <h1>Welcome {user?.name}</h1>
      {isAdmin() && <AdminPanel />}
      {isManager() && <ManagerPanel />}
    </div>
  );
};
```

### 3. Making Authenticated API Calls

```tsx
import { apiClient } from "@/api/client";

// Token is automatically attached to requests
const sessions = await apiClient.getActiveSessions();
const stats = await apiClient.getStats();
```

### 4. Role-based Access Control

```tsx
import { hasRole, isAdmin, isManager } from "@/store/tanstackAuthStore";

// Check specific role
if (hasRole("manager")) {
  // Show manager features
}

// Check admin
if (isAdmin()) {
  // Show admin features
}

// Check manager or admin
if (isManager()) {
  // Show manager+ features
}
```

## Data Persistence

- Authentication state is automatically persisted in localStorage
- Token is automatically loaded on app start
- Invalid tokens are automatically cleared on API errors

## Error Handling

- Network errors are caught and displayed to users
- Invalid tokens trigger automatic logout
- Form validation with helpful error messages
- Loading states for better UX

## Security Features

- JWT token-based authentication
- Automatic token cleanup on logout
- Role-based access control
- Protected routes with automatic redirection
- Secure password handling (minimum 6 characters)

## Future Enhancements

1. **Token Refresh**: Implement automatic token refresh
2. **Session Timeout**: Add session timeout warnings
3. **Multi-factor Authentication**: Add 2FA support
4. **Password Reset**: Implement password reset flow
5. **User Management UI**: Admin interface for user management
6. **Audit Logging**: Track user actions and changes

## Testing

To test the authentication:

1. Start the Fastify server on port 8000
2. Start the GUI development server
3. Navigate to `/auth`
4. Try signing up a new user
5. Test signin with created credentials
6. Check protected routes and role-based features

The system is fully integrated with the Fastify server and ready for production use.
