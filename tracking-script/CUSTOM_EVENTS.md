# Custom Event Tracking Documentation

This documentation explains how to use the CustomEventTracker class that provides semantic user interaction tracking on top of rrweb's raw DOM events.

## Overview

The `CustomEventTracker` class automatically tracks various user interactions and behaviors that provide meaningful insights into user journeys. It complements rrweb's DOM recording with higher-level semantic events.

## Features

### 🔹 1. Navigation Events

Automatically tracks:

- **page_view** - Initial page loads and navigation
- **route_change** - SPA navigation (React Router, Next.js, Vue Router)
- **hash_change** - URL fragment changes (e.g., `#pricing`)
- **back_forward** - Browser back/forward button usage

### 🔹 2. Interaction Events

Automatically tracks:

- **click** - User clicks on interactive elements
- **dblclick** - Double clicks
- **hover** - Hover events on key UI elements
- **scroll** - Scroll depth tracking (25%, 50%, 75%, 100%)
- **context_menu** - Right-click events
- **focus_blur** - Input focus/blur events
- **dead_click** - Clicks on non-interactive elements (UX friction)
- **rage_click** - Rapid repeated clicks (user frustration)

### 🔹 3. Form Events

Automatically tracks:

- **input_change** - Text input into form fields
- **form_submit** - Form submissions
- **form_error** - Validation errors
- **form_abandon** - Started but not completed forms

### 🔹 4. Media Events

Automatically tracks:

- **video_play**, **video_pause**, **video_seek**, **video_end**
- **audio_play**, **audio_pause**

### 🔹 5. Engagement Events

Automatically tracks:

- **time_on_page** - Page dwell time
- **idle** - User inactivity detection
- **active_again** - User returns after idle
- **copy_paste** - Text copying
- **download** - File downloads

### 🔹 6. Error & Friction Events

Automatically tracks:

- **js_error** - JavaScript exceptions
- **network_error** - Failed API calls
- **slow_page** - Pages that load slowly (>5s)

### 🔹 7. Business Events (Manual)

You can manually track:

- **signup_started**, **signup_completed**
- **checkout_started**, **checkout_completed**
- **add_to_cart**, **remove_from_cart**
- **feature_used**
- **conversion**

### 🔹 8. Session Events

Automatically tracks:

- **session_start**, **session_end**
- **user_property** - Custom user attributes

## Configuration

The CustomEventTracker can be configured with these options:

```typescript
interface CustomEventTrackerConfig {
  sessionId: string;
  userId: string;
  debug?: boolean; // Default: false
  enableRageClickDetection?: boolean; // Default: true
  rageClickThreshold?: number; // Default: 3 clicks
  rageClickTimeWindow?: number; // Default: 1000ms
  enableScrollDepthTracking?: boolean; // Default: true
  scrollDepthThresholds?: number[]; // Default: [25, 50, 75, 100]
  enableIdleDetection?: boolean; // Default: true
  idleTimeout?: number; // Default: 30000ms (30s)
  enableFormAbandonment?: boolean; // Default: true
  formAbandonmentTimeout?: number; // Default: 60000ms (60s)
}
```

## Usage Examples

### Basic Usage (Automatic)

The CustomEventTracker is automatically initialized when you create a SessionTracker with `enableCustomEvents: true`:

```typescript
const tracker = new SessionTracker({
  wsUrl: "ws://localhost:8080/ws",
  enableCustomEvents: true, // This enables all automatic tracking
});
```

### Manual Business Event Tracking

Track specific business events in your application:

```typescript
// Track when user starts signup process
tracker.trackBusinessEvent("signup_started", {
  step: "email_form",
  source: "header_cta",
});

// Track when user completes signup
tracker.trackBusinessEvent("signup_completed", {
  method: "email",
  userRole: "free_user",
});

// Track feature usage
tracker.trackBusinessEvent("feature_used", {
  featureName: "advanced_search",
  category: "search",
  value: { filters: ["date", "category"] },
});

// Track e-commerce events
tracker.trackBusinessEvent("add_to_cart", {
  productId: "prod_123",
  price: 29.99,
  currency: "USD",
  category: "digital_product",
});

// Track conversions
tracker.trackBusinessEvent("conversion", {
  type: "purchase",
  value: 99.99,
  currency: "USD",
  step: "checkout_complete",
});
```

### User Property Tracking

Set custom user properties for segmentation:

```typescript
// Set user role
tracker.setUserProperty("role", "premium_user");

// Set A/B test group
tracker.setUserProperty("ab_test_group", "variant_b");

// Set user plan
tracker.setUserProperty("plan", "enterprise");

// Set custom attributes
tracker.setUserProperty("onboarding_completed", "true");
```

## Event Data Structure

All custom events follow this structure:

```typescript
interface BaseCustomEvent {
  sessionId: string;
  userId: string;
  timestamp: number;
  url: string;
  type: string; // Event type (e.g., 'click', 'form_submit')
  data: any; // Event-specific data
}
```

### Example Event Data

#### Click Event

```json
{
  "sessionId": "session_123...",
  "userId": "user_456...",
  "timestamp": 1692123456789,
  "url": "https://example.com/pricing",
  "type": "click",
  "data": {
    "element": {
      "tag": "button",
      "text": "Start Free Trial",
      "id": "cta-button",
      "className": "btn btn-primary",
      "path": "header > nav > button#cta-button",
      "component": "CTAButton"
    },
    "position": { "x": 150, "y": 300 },
    "viewport": { "width": 1920, "height": 1080 }
  }
}
```

#### Form Submit Event

```json
{
  "sessionId": "session_123...",
  "userId": "user_456...",
  "timestamp": 1692123456789,
  "url": "https://example.com/signup",
  "type": "form_submit",
  "data": {
    "formId": "signup-form",
    "formPath": "main > form#signup-form",
    "fieldCount": 5,
    "completedFields": 4
  }
}
```

#### Business Event

```json
{
  "sessionId": "session_123...",
  "userId": "user_456...",
  "timestamp": 1692123456789,
  "url": "https://example.com/checkout",
  "type": "feature_used",
  "data": {
    "featureName": "promo_code",
    "category": "checkout",
    "value": { "code": "SAVE20", "discount": 20 }
  }
}
```

## Best Practices

### 1. Privacy and Security

- Sensitive form data is automatically masked
- Personal information should not be included in custom events
- Use anonymized user IDs when possible

### 2. Event Naming

- Use consistent naming conventions for business events
- Include relevant context in event data
- Keep event names descriptive but concise

### 3. Performance

- Events are batched and sent efficiently
- Custom event tracking adds minimal overhead
- Use appropriate sampling for high-frequency events

### 4. Analysis

- Combine custom events with rrweb replay data for complete insights
- Create funnels using business events
- Use form events to identify UX friction points
- Monitor rage clicks and dead clicks for usability issues

## Integration with rrweb Player

Custom events can be visualized in the rrweb player timeline:

```typescript
new rrwebPlayer({
  target: document.body,
  props: {
    events,
    // Configure colors for custom event tags
    tags: {
      click: "#21e676",
      form_submit: "#2196f3",
      signup_completed: "#4caf50",
      rage_click: "#f44336",
      feature_used: "#ff9800",
    },
  },
});
```

## Debugging

Enable debug mode to see custom events in the console:

```typescript
const tracker = new SessionTracker({
  wsUrl: "ws://localhost:8080/ws",
  debug: true, // This will log all custom events
  enableCustomEvents: true,
});
```

## Common Use Cases

### 1. Conversion Funnel Analysis

Track the complete user journey from awareness to conversion:

```typescript
// Landing page view (automatic)
// Button clicks (automatic)
tracker.trackBusinessEvent("signup_started", { source: "pricing_page" });
// Form interactions (automatic)
tracker.trackBusinessEvent("signup_completed", { method: "google" });
tracker.trackBusinessEvent("checkout_started", { plan: "pro" });
tracker.trackBusinessEvent("conversion", {
  type: "subscription",
  value: 29.99,
});
```

### 2. Feature Adoption Tracking

Monitor how users interact with new features:

```typescript
tracker.trackBusinessEvent("feature_used", {
  featureName: "new_dashboard",
  isFirstTime: true,
  timeToDiscovery: 120000, // 2 minutes
});
```

### 3. UX Friction Detection

Identify problematic areas in your UI:

```typescript
// Automatically tracked:
// - rage_click events indicate user frustration
// - dead_click events show confusion
// - form_abandon events reveal friction in forms
// - slow_page events highlight performance issues
```

### 4. A/B Testing

Track experiment participation and outcomes:

```typescript
tracker.setUserProperty("experiment_group", "variant_a");
tracker.trackBusinessEvent("conversion", {
  type: "goal_completion",
  experiment: "checkout_flow_test",
  variant: "variant_a",
});
```

This comprehensive custom event tracking system provides deep insights into user behavior while maintaining privacy and performance standards.
