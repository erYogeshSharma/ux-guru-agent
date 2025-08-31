import {
  EventType,
  IncrementalSource,
  MediaInteractions,
  MouseInteractions,
  NodeType,
  PointerTypes,
  eventWithTime,
  eventWithoutTime,
} from "@rrweb/types";

type DescribeResult = {
  eventType: string;
  incrementalSource?: string;
  mediaInteraction?: string;
  mouseInteraction?: string;
  pointerType?: string;
  nodeType?: string;
  extra?: Record<string, unknown>;
};

/**
 * Given an rrweb event (with or without time) return human readable names
 * for enums commonly useful in the UI.
 */
export function describeEvent(
  e: eventWithTime | eventWithoutTime
): DescribeResult {
  const out: DescribeResult = {
    eventType: enumToString(EventType, (e as any).type),
    extra: {},
  };

  // Incremental snapshot -> look for source and typed payloads
  if ((e as any).type === EventType.IncrementalSnapshot) {
    const data = (e as any).data;
    if (data && typeof data.source === "number") {
      out.incrementalSource = enumToString(IncrementalSource, data.source);
    }

    // Media interaction payload
    if (
      data &&
      data.source === IncrementalSource.MediaInteraction &&
      typeof data.type === "number"
    ) {
      out.mediaInteraction = enumToString(MediaInteractions, data.type);
      // copy some useful values for UI
      out.extra = {
        id: data.id,
        currentTime: data.currentTime,
        muted: data.muted,
        volume: data.volume,
      };
    }

    // Mouse interaction payload
    if (
      data &&
      data.source === IncrementalSource.MouseInteraction &&
      typeof data.type === "number"
    ) {
      out.mouseInteraction = enumToString(MouseInteractions, data.type);
      if (typeof data.pointerType !== "undefined") {
        out.pointerType = enumToString(PointerTypes, data.pointerType);
      }
      out.extra = {
        id: data.id,
        x: data.x,
        y: data.y,
      };
    }

    // Canvas / other incremental types may carry a `type` field (CanvasContext etc.)
    // Node-related info: fullSnapshot contains serialized node
  }

  // Full snapshot -> describe root node type if present
  if ((e as any).type === EventType.FullSnapshot) {
    const node = (e as any).data?.node;
    if (node && typeof node.type === "number") {
      out.nodeType = enumToString(NodeType, node.type);
      out.extra = {
        rootId: node.rootId,
        isShadowHost: !!node.isShadowHost,
      };
    }
  }

  // Custom/other events -> attach whatever useful fields exist
  // (keeps function tolerant to different shapes)

  if ((e as any).type === EventType.Custom) {
    out.extra = { ...((e as any).data || {}) };
  }
  return out;
}

/** Helper: map numeric enum -> string label safely */
function enumToString(enumObj: Record<string, any>, val: unknown): string {
  if (val === null || typeof val === "undefined") return "unknown";
  // ts enums compile to an object with reverse mappings; try that first
  // but fall back to toString
  const byKey = enumObj[val as any];
  if (typeof byKey === "string") return byKey;
  return String(val);
}
