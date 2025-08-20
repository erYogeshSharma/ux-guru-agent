# TanStack Router Setup

This application now uses TanStack Router for client-side routing. Here's the structure:

## Routes

- `/` - Redirects to dashboard if authenticated, otherwise to auth
- `/auth` - Sign in page (public route)
- `/dashboard` - Main dashboard (protected route)
- `/sessions` - Session list page (protected route)
- `/player/:sessionId` - Session player page (protected route)

## File Structure

```
src/
├── routes/
│   ├── index.ts         # Router configuration
│   ├── routeTree.tsx    # Route definitions and tree
│   └── config.ts        # Route constants and helpers
├── pages/
│   ├── auth/
│   │   └── AuthPage.tsx
│   ├── dashboard/
│   │   └── DashboardPage.tsx
│   ├── sessions/
│   │   └── SessionsPage.tsx
│   ├── player/
│   │   └── PlayerPage.tsx
│   └── index.ts         # Page exports
├── contexts/
│   └── AuthContext.tsx  # Authentication context
└── components/
    └── ProtectedRoute.tsx
```

## Features

- **Protected Routes**: Dashboard, sessions, and player require authentication
- **Public Routes**: Auth page is public
- **Auto Redirects**: Automatic redirects based on authentication status
- **Route Guards**: beforeLoad hooks check authentication before rendering
- **Clean URLs**: Semantic URLs for better UX
- **TypeScript**: Fully typed routes and parameters

## Authentication

Simple authentication is implemented using:
- React Context for state management
- localStorage for persistence
- Route guards for protection

## Usage

### Navigation
```tsx
import { useNavigate } from '@tanstack/react-router'
import { ROUTES } from '@/routes/config'

const navigate = useNavigate()
navigate({ to: ROUTES.DASHBOARD })
```

### Route Parameters
```tsx
import { useParams } from '@tanstack/react-router'

const { sessionId } = useParams({ from: '/player/$sessionId' })
```

### Route Constants
```tsx
import { ROUTES, getPlayerRoute } from '@/routes/config'

// Navigate to specific session
navigate({ to: getPlayerRoute('session-123') })
```

## Development

The router includes TanStack Router DevTools for debugging routes in development mode.
