# Component Structure

This project has been restructured to use Material-UI components and follows a modular architecture with separated concerns.

## Directory Structure

```
src/
├── components/           # Reusable UI components
│   ├── ConnectionStatus.tsx
│   ├── ErrorAlert.tsx
│   ├── LoadingOverlay.tsx
│   ├── SessionControls.tsx
│   ├── SessionList.tsx
│   ├── WelcomeScreen.tsx
│   └── index.ts
├── hooks/               # Custom React hooks
│   ├── useSessionReplayWebSocket.ts
│   └── index.ts
├── types/               # TypeScript type definitions
│   └── index.ts
├── App.tsx             # Main application component
└── main.tsx            # Application entry point
```

## Components

### ConnectionStatus

- Displays the WebSocket connection status in the app bar
- Shows connection state with colored indicators
- Uses Material-UI AppBar, Toolbar, and Chip components

### ErrorAlert

- Shows error messages with dismiss functionality
- Uses Material-UI Alert component
- Automatically dismissible

### LoadingOverlay

- Full-screen loading indicator
- Uses Material-UI Backdrop and CircularProgress
- Customizable message

### SessionControls

- Playback controls for session replay
- Play/pause, restart, speed control
- Session information display
- Uses Material-UI Button, Chip, and IconButton components

### SessionList

- Sidebar showing active sessions
- Search and filter functionality
- Session details and metadata
- Uses Material-UI List, ListItem, and Paper components

### WelcomeScreen

- Landing page when no session is selected
- Feature highlights
- Uses Material-UI Container, Card, and Typography

## Hooks

### useSessionReplayWebSocket

- Manages WebSocket connection for session replay
- Handles all WebSocket events and state
- Provides clean API for session management
- Includes automatic reconnection logic

## Types

All TypeScript interfaces and types are centralized in the `types/` directory:

- `Session` - Session data structure
- `ReplayState` - Replay control state
- `SessionReplayViewerProps` - Main component props
- Component-specific prop interfaces

## Features

- **Material Design**: Uses Material-UI components throughout
- **Theme Support**: Integrated with MUI theme system
- **Responsive**: Adapts to different screen sizes
- **Accessibility**: Follows Material Design accessibility guidelines
- **Type Safety**: Full TypeScript support
- **Modular**: Separated components for maintainability
- **Clean Architecture**: Hooks for business logic separation

## Color Scheme

The application uses Material-UI's default theme with:

- Primary color: Blue (#1976d2)
- Secondary color: Pink (#dc004e)
- Success color: Green (for live indicators)
- Error color: Red (for errors)
- Warning color: Orange (for connection states)

All colors are derived from the MUI theme and not hardcoded.
