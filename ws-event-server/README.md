# Session Replay Server

A high-performance WebSocket server for real-time session recording and replay with PostgreSQL persistence and comprehensive logging.

## Features

- ✨ **Fastify + WebSocket**: High-performance HTTP and WebSocket server
- 🗄️ **PostgreSQL Integration**: Persistent storage with batch processing
- 📝 **Daily Rotating Logs**: Comprehensive logging with Winston
- 🔄 **Real-time Broadcasting**: Live session viewing capabilities
- 📊 **Performance Monitoring**: Built-in statistics and health checks
- 🛡️ **Error Handling**: Robust error handling and recovery
- 🧹 **Automatic Cleanup**: Session cleanup and memory management

## Architecture

The server is built with a modular architecture:

```
src/
├── config/           # Configuration management
├── database/         # PostgreSQL service and queries
├── handlers/         # Message handlers
├── services/         # Core business logic
│   ├── FastifyServer.ts      # Main Fastify server
│   ├── SessionService.ts     # Session management
│   └── WebSocketService.ts   # WebSocket handling
├── types/            # TypeScript type definitions
├── utils/            # Utilities (logger, etc.)
└── index.ts          # Application entry point
```

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

## Installation

1. Install dependencies:

```bash
npm install
```

2. Copy environment configuration:

```bash
cp .env.example .env
```

3. Configure your PostgreSQL database in `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=session_replay
DB_USER=postgres
DB_PASSWORD=postgres
```

4. Start PostgreSQL database (make sure it's running on localhost:5432)

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## API Endpoints

### REST API

- `GET /` - Server information
- `GET /health` - Health check with detailed stats
- `GET /stats` - Server statistics
- `GET /sessions/active` - Get all active sessions
- `GET /sessions/:sessionId/events` - Get events for a specific session
- `DELETE /sessions/cleanup` - Manually cleanup old sessions

### WebSocket Endpoint

Connect to: `ws://localhost:8080/ws`

#### Client Types

**Tracker Client** (`?type=tracker`):

- Records user sessions
- Sends events in batches
- Manages session lifecycle

**Viewer Client** (`?type=viewer`):

- Watches live sessions
- Receives real-time events
- Can replay historical sessions

#### Message Types

**From Tracker:**

```javascript
// Start session
{
  type: "session_start",
  data: {
    sessionId: "uuid",
    userId: "user123",
    url: "https://example.com",
    userAgent: "...",
    viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
    startTime: 1234567890,
    referrer: "...",
    timeZone: "America/New_York"
  }
}

// Send events batch
{
  type: "events_batch",
  data: {
    events: [/* array of events */]
  }
}

// End session
{
  type: "session_end",
  data: { sessionId: "uuid" }
}
```

**From Viewer:**

```javascript
// Join session for live viewing
{
  type: "viewer_join_session",
  data: { sessionId: "uuid" }
}

// Leave session
{
  type: "viewer_leave_session",
  data: { sessionId: "uuid" }
}

// Get session events
{
  type: "get_session_events",
  data: { sessionId: "uuid", fromIndex: 0 }
}
```

## Configuration

Configuration is managed through environment variables. See `.env.example` for all available options.

### Key Settings

- `BATCH_SIZE`: Number of sessions to process in each database batch (default: 50)
- `BATCH_INTERVAL`: How often to process batches in milliseconds (default: 5000)
- `MAX_EVENTS_PER_SESSION`: Maximum events per session before trimming (default: 20000)
- `SESSION_CLEANUP_INTERVAL`: How often to cleanup old sessions (default: 300000ms)

## Database Schema

The server automatically creates the following tables:

- `sessions` - Session metadata and status
- `session_events` - Event data in batches
- `session_errors` - Error tracking

## Logging

Logs are automatically rotated daily and stored in the `logs/` directory:

- `application-YYYY-MM-DD.log` - General application logs
- `error-YYYY-MM-DD.log` - Error-level logs only
- `exceptions-YYYY-MM-DD.log` - Uncaught exceptions
- `rejections-YYYY-MM-DD.log` - Unhandled promise rejections

## Performance

The server is optimized for high throughput:

- **Batch Processing**: Events are queued and processed in batches
- **Connection Pooling**: PostgreSQL connections are pooled
- **Memory Management**: Sessions are automatically trimmed and cleaned up
- **Heartbeat Monitoring**: Stale connections are automatically removed

## Monitoring

Monitor server health via:

- `GET /health` - Detailed health information
- `GET /stats` - Performance statistics
- Log files for detailed debugging

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure proper database credentials
3. Set up log rotation
4. Monitor the `/health` endpoint
5. Set up PostgreSQL backups

## License

MIT
