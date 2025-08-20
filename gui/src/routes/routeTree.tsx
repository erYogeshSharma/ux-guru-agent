import { createRootRoute, createRoute, Outlet, redirect } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { Box } from '@mui/material'
import { lazy } from 'react'

// Lazy load page components
const AuthPage = lazy(() => import('@/pages/auth/AuthPage'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const SessionsPage = lazy(() => import('@/pages/sessions/SessionsPage'))
const PlayerPage = lazy(() => import('@/pages/player/PlayerPage'))

// Simple auth check function - in real app, this would check tokens/session
const isAuthenticated = () => {
  // For now, just check localStorage or a simple state
  return localStorage.getItem('isAuthenticated') === 'true'
}

// Root route
export const rootRoute = createRootRoute({
  component: () => (
    <Box sx={{ minHeight: '100vh' }}>
      <Outlet />
      <TanStackRouterDevtools />
    </Box>
  ),
})

// Auth routes (public)
export const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
  component: AuthPage,
  beforeLoad: () => {
    // If already authenticated, redirect to dashboard
    if (isAuthenticated()) {
      throw redirect({ to: '/dashboard' })
    }
  },
})

// Protected routes
export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: '/auth' })
    }
  },
})

export const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions',
  component: SessionsPage,
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: '/auth' })
    }
  },
})

export const playerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/player/$sessionId',
  component: PlayerPage,
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: '/auth' })
    }
  },
})

// Index route - redirect to appropriate page
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: '/dashboard' })
    } else {
      throw redirect({ to: '/auth' })
    }
  },
  component: () => null,
})

// Route tree
export const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  dashboardRoute,
  sessionsRoute,
  playerRoute,
])
