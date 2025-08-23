// UX Guru Tracking Script Configuration
//
// Organizations should modify these values when embedding the script:

export interface TrackingConfig {
  // REQUIRED: Your unique organization identifier provided by UX Guru
  organizationId: string;

  // REQUIRED: UX Guru WebSocket server URL
  wsUrl: string;

  // Optional: Enable debug logging (set to false in production)
  debug?: boolean;

  // Optional: How many events to batch before sending
  batchSize?: number;

  // Optional: How often to flush events (in milliseconds)
  flushInterval?: number;

  // Optional: Enable custom event tracking (rage clicks, form abandonment, etc.)
  enableCustomEvents?: boolean;

  // Optional: Custom recording options for rrweb
  recordOptions?: any;
}

// DEFAULT CONFIGURATION
// Organizations should override these values:
export const DEFAULT_CONFIG: TrackingConfig = {
  organizationId: "acd0c704-8307-4fd2-bb67-ac99724fb2c4", // CHANGE THIS
  wsUrl: "ws://localhost:8080/ws", // CHANGE THIS to your server
  debug: true, // Set to false in production
  batchSize: 50,
  flushInterval: 3000,
  enableCustomEvents: true,
};
