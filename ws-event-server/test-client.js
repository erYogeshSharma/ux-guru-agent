const WebSocket = require("ws");

// Simple test client to demonstrate the WebSocket functionality
class TestClient {
  constructor(type, sessionId) {
    this.sessionId = sessionId || `test-session-${Date.now()}`;
    this.ws = new WebSocket(`ws://localhost:8080/ws?type=${type}`);
    this.type = type;

    this.ws.on("open", () => {
      console.log(`✅ ${type} connected`);

      if (type === "tracker") {
        this.startSession();
      } else {
        this.joinSession();
      }
    });

    this.ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      console.log(`📨 Received:`, message.type, message.data);
    });

    this.ws.on("close", () => {
      console.log(`👋 ${type} disconnected`);
    });

    this.ws.on("error", (error) => {
      console.error("❌ WebSocket error:", error);
    });
  }

  startSession() {
    this.ws.send(
      JSON.stringify({
        type: "session_start",
        data: {
          sessionId: this.sessionId,
          userId: "test-user-123",
          url: "https://example.com",
          userAgent: "Test Client 1.0",
          viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
          startTime: Date.now(),
          lastActivity: Date.now(),
          referrer: "",
          timeZone: "UTC",
        },
      })
    );

    // Send some test events
    setTimeout(() => {
      this.sendEvents();
    }, 1000);
  }

  sendEvents() {
    const events = [
      { type: "click", x: 100, y: 200, timestamp: Date.now() },
      { type: "scroll", scrollY: 500, timestamp: Date.now() + 100 },
      { type: "mousemove", x: 300, y: 400, timestamp: Date.now() + 200 },
    ];

    this.ws.send(
      JSON.stringify({
        type: "events_batch",
        data: { events },
      })
    );

    console.log(
      `📊 Sent ${events.length} events for session ${this.sessionId}`
    );
  }

  joinSession() {
    setTimeout(() => {
      this.ws.send(
        JSON.stringify({
          type: "viewer_join_session",
          data: { sessionId: this.sessionId },
        })
      );
    }, 500);
  }

  close() {
    this.ws.close();
  }
}

// Example usage
async function runTest() {
  console.log("🧪 Starting WebSocket test...");

  // Create a tracker client
  const tracker = new TestClient("tracker");

  // Create a viewer client after a short delay
  setTimeout(() => {
    const viewer = new TestClient("viewer", tracker.sessionId);

    // Clean up after 10 seconds
    setTimeout(() => {
      tracker.close();
      viewer.close();
      console.log("✅ Test completed");
      process.exit(0);
    }, 10000);
  }, 2000);
}

// Only run if this file is executed directly
if (require.main === module) {
  runTest();
}
