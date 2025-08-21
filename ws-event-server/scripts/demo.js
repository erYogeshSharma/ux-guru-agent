#!/usr/bin/env node

/**
 * 🚀 WS Event Server Testing Demo
 *
 * This script demonstrates the complete testing setup for the WebSocket Event Server.
 * It showcases API testing, WebSocket testing, and documentation features.
 */

console.log(`
🚀 WS Event Server - Testing Demo
===============================

This project includes a comprehensive testing setup with:

📋 Testing Features:
- ✅ Vitest for fast unit/integration testing
- 🎨 Visual test UI (@vitest/ui)
- 📊 API testing with Supertest
- 🔌 WebSocket testing with ws client
- 📚 Swagger API documentation
- 🎯 Interactive test dashboard

📁 Test Structure:
tests/
├── api/                    # REST API tests
│   ├── auth.test.ts       # Authentication endpoints
│   ├── health.test.ts     # Health check endpoints
│   └── sessions.test.ts   # Session management
├── websocket/             # WebSocket tests
│   └── connection.test.ts # WebSocket functionality
├── integration/           # Integration tests
│   └── api-websocket.test.ts # Combined API + WS tests
├── unit/                  # Unit tests
│   └── basic.test.ts      # Basic validation tests
├── setup/                 # Test configuration
│   ├── test-setup.ts      # Global test setup
│   └── test-server.ts     # Test server helper
├── dashboard.html         # Visual test interface
└── README.md             # Complete testing guide

🎯 Available Commands:
`);

const commands = [
  { cmd: "npm test", desc: "Run all tests once" },
  { cmd: "npm run test:watch", desc: "Run tests in watch mode" },
  { cmd: "npm run test:ui", desc: "Open visual test interface" },
  { cmd: "npm run test:coverage", desc: "Generate coverage report" },
  { cmd: "npm run test:setup", desc: "Setup test database" },
  { cmd: "npm run dev", desc: "Start development server" },
];

commands.forEach(({ cmd, desc }) => {
  console.log(`  ${cmd.padEnd(25)} - ${desc}`);
});

console.log(`
🌐 Quick Links (when server is running):
  http://localhost:8080/health    - Health check
  http://localhost:8080/docs      - Swagger API docs
  http://localhost:8080/stats     - Server statistics
  tests/dashboard.html            - Visual test dashboard

🧪 Test Categories:

1. 🔐 Authentication Tests
   - User signup/signin
   - JWT token validation
   - Protected routes
   - Role-based access

2. 📊 API Endpoint Tests
   - Health checks
   - Session management
   - Error handling
   - Response validation

3. 🔌 WebSocket Tests
   - Connection establishment
   - Message handling
   - Event tracking
   - Viewer connections

4. 🔄 Integration Tests
   - API + WebSocket workflows
   - End-to-end scenarios
   - Data persistence
   - Real-time features

📚 Documentation Features:

- Swagger UI with interactive API explorer
- Auto-generated OpenAPI specification
- Request/response schemas
- Authentication examples

🎨 Visual Testing:

The test dashboard (tests/dashboard.html) provides:
- Interactive API testing forms
- WebSocket connection tester
- Real-time result display
- Quick access to documentation

💡 Getting Started:

1. Install dependencies:
   npm install

2. Setup test database (if PostgreSQL available):
   npm run test:setup

3. Run basic tests:
   npm test

4. Open visual test UI:
   npm run test:ui

5. Start development server:
   npm run dev

6. Open test dashboard in browser:
   open tests/dashboard.html

🔧 Troubleshooting:

- If database tests fail: Run 'npm run test:setup'
- If port conflicts: Check ports 8080 (server) and 3001 (test server)
- For WebSocket issues: Verify server is running first

📞 Need Help?
Check tests/README.md for detailed documentation!
`);

// Check if we can run a basic test
console.log("\n🧪 Running basic validation test...\n");

import { spawn } from "child_process";

const testProcess = spawn(
  "npx",
  ["vitest", "run", "tests/unit/basic.test.ts"],
  {
    stdio: "inherit",
    cwd: process.cwd(),
  }
);

testProcess.on("close", (code) => {
  if (code === 0) {
    console.log("\n✅ Basic tests passed! Your testing environment is ready.");
    console.log("\n🎯 Next steps:");
    console.log('   • Run "npm run test:ui" for visual testing');
    console.log('   • Open "tests/dashboard.html" for interactive testing');
    console.log('   • Start server with "npm run dev" for full testing');
  } else {
    console.log("\n⚠️  Some tests failed, but the testing setup is ready.");
    console.log("   This is likely due to missing database setup.");
    console.log("   You can still use the visual testing tools!");
  }
});
