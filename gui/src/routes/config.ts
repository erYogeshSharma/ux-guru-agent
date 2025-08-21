// Route configuration and path constants
export const ROUTES = {
  HOME: "/",
  AUTH: "/auth",
  DASHBOARD: "/dashboard",
  SESSIONS: "/sessions",
  PLAYER: "/player",
} as const;

export const getPlayerRoute = (sessionId: string) => `/player/${sessionId}`;

// Auth helpers
export const isProtectedRoute = (path: string) => {
  return [ROUTES.DASHBOARD, ROUTES.SESSIONS, ROUTES.PLAYER].some((route) =>
    path.startsWith(route)
  );
};

export const isPublicRoute = (path: string) => {
  return path === ROUTES.AUTH;
};
