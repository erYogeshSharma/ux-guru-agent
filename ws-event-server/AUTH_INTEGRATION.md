# Authentication Integration Guide

## Overview

The WebSocket Event Server now supports organization-based authentication. Organizations can sign up, sign in, and track sessions that are automatically associated with their organization.

## Authentication Flow

### 1. Organization Signup

```bash
POST /auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "admin@company.com",
  "companyName": "Acme Corp",
  "password": "securepassword123"
}
```

Response:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "organization": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "companyName": "Acme Corp",
    "email": "admin@company.com"
  }
}
```

### 2. Organization Sign In

```bash
POST /auth/signin
Content-Type: application/json

{
  "email": "admin@company.com",
  "password": "securepassword123"
}
```

Response: Same as signup

### 3. Get Organization Info

```bash
GET /auth/me
Authorization: Bearer <token>
```

## Tracking Script Integration

### Tracker WebSocket Messages

When starting a session from the tracking script, include the `organizationId`:

```javascript
// In your tracking script
const ws = new WebSocket("ws://localhost:8080/ws?type=tracker");

ws.onopen = () => {
  // Start session with organization ID
  ws.send(
    JSON.stringify({
      type: "session_start",
      data: {
        sessionId: generateSessionId(), // optional, server will generate if not provided
        userId: getCurrentUserId(),
        organizationId: "YOUR_ORGANIZATION_ID", // <- Add this from your tracking script config
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        },
        referrer: document.referrer,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    })
  );
};

// Send events batch with organization context (handled automatically)
ws.send(
  JSON.stringify({
    type: "events_batch",
    data: {
      events: [
        { type: "click", target: ".button", timestamp: Date.now() },
        { type: "scroll", x: 0, y: 100, timestamp: Date.now() },
      ],
    },
  })
);
```

### Viewer WebSocket (For Admin Dashboard)

Viewers (admin dashboard) should authenticate via JWT:

```javascript
// In your admin dashboard
const token = localStorage.getItem("authToken");

// Optional: Verify token first
fetch("/auth/me", {
  headers: { Authorization: `Bearer ${token}` },
});

// Connect to view sessions
const ws = new WebSocket("ws://localhost:8080/ws?type=viewer");

ws.onopen = () => {
  // Request active sessions (will only show sessions for your organization)
  ws.send(
    JSON.stringify({
      type: "get_active_sessions",
    })
  );

  // Join a specific session
  ws.send(
    JSON.stringify({
      type: "viewer_join_session",
      data: { sessionId: "some-session-id" },
    })
  );
};
```

## REST API Endpoints

All session endpoints now require authentication:

### Get Active Sessions

```bash
GET /sessions/active
Authorization: Bearer <token>
```

### Get All Sessions (Paginated)

```bash
GET /sessions?limit=50&offset=0
Authorization: Bearer <token>
```

### Get Session Events

```bash
GET /sessions/:sessionId/events?fromIndex=0&limit=1000
Authorization: Bearer <token>
```

## Key Features

1. **Organization Isolation**: Each organization only sees their own sessions
2. **Automatic Association**: Sessions are automatically linked to organizations via the tracking script
3. **JWT Authentication**: Secure token-based authentication with 7-day expiration
4. **Backward Compatibility**: Existing tracking functionality remains unchanged, just add `organizationId`

## Environment Variables

Add to your `.env` file:

```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

## Database Schema

The system automatically creates the following new tables:

- `organizations`: Stores organization details and credentials
- Adds `organization_id` column to existing `sessions` table

## Security Notes

1. Use strong JWT secrets in production
2. JWT tokens expire in 7 days
3. Passwords are hashed with bcrypt (12 rounds)
4. Organization data is isolated - no cross-organization access
5. Tracking scripts should securely store and transmit organization IDs
