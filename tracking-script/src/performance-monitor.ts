/**
 * Performance monitor that adjusts snapshot quality and frequency
 * based on device capabilities and current performance
 */
export class PerformanceMonitor {
  private lastFrameTime = performance.now();
  private frameCount = 0;
  private avgFrameTime = 16.67; // Target 60fps = 16.67ms per frame
  private performanceLevel: "high" | "medium" | "low" = "high";

  constructor() {
    this.startMonitoring();
    this.detectDeviceCapabilities();
  }

  private startMonitoring(): void {
    const measureFrame = () => {
      const now = performance.now();
      const frameTime = now - this.lastFrameTime;
      this.lastFrameTime = now;

      // Rolling average of frame times
      this.avgFrameTime = this.avgFrameTime * 0.9 + frameTime * 0.1;
      this.frameCount++;

      // Update performance level every 60 frames
      if (this.frameCount % 60 === 0) {
        this.updatePerformanceLevel();
      }

      requestAnimationFrame(measureFrame);
    };

    requestAnimationFrame(measureFrame);
  }

  private detectDeviceCapabilities(): void {
    // Check device memory (if available)
    const memory = (navigator as any).deviceMemory;
    const cores = navigator.hardwareConcurrency;

    if (memory && memory < 4) {
      this.performanceLevel = "low";
    } else if (cores && cores < 4) {
      this.performanceLevel = "medium";
    }
  }

  private updatePerformanceLevel(): void {
    if (this.avgFrameTime > 33) {
      // Worse than 30fps
      this.performanceLevel = "low";
    } else if (this.avgFrameTime > 20) {
      // Worse than 50fps
      this.performanceLevel = "medium";
    } else {
      this.performanceLevel = "high";
    }
  }

  getOptimalSettings() {
    switch (this.performanceLevel) {
      case "low":
        return {
          quality: 0.4,
          scale: 0.5,
          snapshotDelay: 2000,
          maxPixels: 400000,
        };
      case "medium":
        return {
          quality: 0.6,
          scale: 0.75,
          snapshotDelay: 1000,
          maxPixels: 600000,
        };
      case "high":
      default:
        return {
          quality: 0.8,
          scale: 1.0,
          snapshotDelay: 500,
          maxPixels: 800000,
        };
    }
  }

  getPerformanceLevel() {
    return this.performanceLevel;
  }
}
