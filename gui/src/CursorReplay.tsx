import React, { useEffect, useState, useRef, useLayoutEffect } from "react";

export interface CursorEvent {
  type: "cursorMove" | "click" | "windowDimension" | "snapshot";
  payload: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    data?: string; // for snapshot
    // New optimized snapshot fields
    type?: "full" | "viewport" | "diff" | "tile";
    tileX?: number;
    tileY?: number;
    tileWidth?: number;
    tileHeight?: number;
    diffRegions?: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      data: string;
    }>;
    scrollX?: number;
    scrollY?: number;
    viewportWidth?: number;
    viewportHeight?: number;
  };
  timestamp: number;
}

interface Props {
  events: CursorEvent[];
}

const CursorReplay: React.FC<Props> = ({ events }) => {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [snapshot, setSnapshot] = useState<CursorEvent | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [clicked, setClicked] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });

  useEffect(() => {
    if (!events.length) return;

    const lastEvent = events[events.length - 1];

    if (lastEvent.type === "cursorMove") {
      if (lastEvent.payload.x != null && lastEvent.payload.y != null) {
        setCursorPos({
          x: lastEvent.payload.x,
          y: lastEvent.payload.y,
        });
      }
    } else if (lastEvent.type === "windowDimension") {
      if (lastEvent.payload.width && lastEvent.payload.height) {
        setDimensions({
          width: lastEvent.payload.width,
          height: lastEvent.payload.height,
        });
      }
    } else if (lastEvent.type === "click") {
      setClicked(true);
      setTimeout(() => setClicked(false), 300); // click animation reset
    } else if (lastEvent.type === "snapshot") {
      console.log(
        "Snapshot event received:",
        lastEvent.payload.data?.substring(200, 800)
      );
      setSnapshot(lastEvent);
    }
  }, [events]);
  console.log(snapshot);
  // Measure available container size and update scale
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setContainerSize({ width: cr.width, height: cr.height });
      }
    });

    ro.observe(el);
    // set initial
    const rect = el.getBoundingClientRect();
    console.log("Container size:", rect.width, rect.height);
    setContainerSize({ width: rect.width, height: rect.height });

    return () => ro.disconnect();
  }, []);

  // compute scale to fit the stage into the available container (only scale down)
  const scale = Math.min(
    1,
    containerSize.width / Math.max(1, dimensions.width),
    containerSize.height / Math.max(1, dimensions.height)
  );

  // Use the scale to compute the actual rendered stage size. We resize the stage
  // element itself instead of only using CSS `transform: scale(...)` so that
  // flexbox centering and layout reflect the scaled size. Also scale cursor
  // coordinates so the pointer lands at the correct visual position.
  const stageWidth = Math.max(0, dimensions.width * scale);
  const stageHeight = Math.max(0, dimensions.height * scale);

  // position using transform for smoother GPU-accelerated motion. We must
  // multiply the recorded cursor coordinates by the scale so the pointer
  // matches the visually scaled stage.
  const cursorTransform = `translate3d(${cursorPos.x * scale}px, ${
    cursorPos.y * scale
  }px, 0) translate(-50%, -50%)`;

  // accept either a full data URL (data:...) or a raw base64 string in snapshot.payload.data
  const bgData = snapshot?.payload.data;
  const bgImageUrl = bgData
    ? bgData.startsWith("data:")
      ? bgData
      : `data:image/png;base64,${bgData}`
    : null;

  return (
    <div
      ref={containerRef}
      style={{
        border: "1px solid #ccc",
        background: "#000",
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          // inner stage is resized to the scaled size so layout (centering)
          // and pointer coordinates line up with the visible stage.
          width: stageWidth,
          height: stageHeight,
          border: "1px solid #ccc",
          background: snapshot ? "transparent" : "#f9f9f9",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Render the snapshot image inside the stage so it stays underneath the cursor */}
        {bgImageUrl && (
          <img
            src={bgImageUrl}
            alt="snapshot"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}
        {/* Cursor */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: cursorTransform,
            pointerEvents: "none",
            willChange: "transform",
            transition: "transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            zIndex: 300, // make sure cursor is above the snapshot image
          }}
        >
          {/* Cursor icon - layered for high contrast (dark outline + light fill) */}
          <div
            style={{
              position: "relative",
              width: 18,
              height: 18,
              transform: "translate(-50%,-50%)",
            }}
          >
            {/* outer stroke (dark) */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 18,
                height: 18,
                background: "black",
                clipPath: "polygon(0 0, 100% 50%, 0 100%)",
                zIndex: 200,
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
              }}
            />

            {/* inner fill (light) */}
            <div
              style={{
                position: "absolute",
                left: 3,
                top: 3,
                width: 12,
                height: 12,
                background: "#fff",
                clipPath: "polygon(0 0, 100% 50%, 0 100%)",
                zIndex: 201,
                boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
              }}
            />
          </div>

          {/* Click indication - layered rings for visibility on both dark/light images */}
          {clicked && (
            <div
              style={{
                position: "absolute",
                left: -16,
                top: -16,
                width: 40,
                height: 40,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "pulse 0.35s ease-out",
                zIndex: 250,
              }}
            >
              {/* outer outline: white border + black outer shadow for contrast */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.95)",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.85)",
                }}
              />
              {/* inner red ring */}
              <div
                style={{
                  position: "absolute",
                  left: 8,
                  top: 8,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,0,0,0.95)",
                }}
              />
            </div>
          )}
        </div>

        {/* Click pulse animation */}
        <style>
          {`
            @keyframes pulse {
              0% { transform: scale(0.6); opacity: 0.8; }
              100% { transform: scale(1.6); opacity: 0; }
            }
          `}
        </style>
      </div>
    </div>
  );
};

export default CursorReplay;
