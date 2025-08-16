import { Store } from "@tanstack/store";
import type { eventWithTime, Session } from "../types";

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  totalTime: number;
  speed: number;
  progress: number;
  skipInactive: boolean;
}

// rrweb-player instance type
export interface RRWebPlayer {
  toggle: () => void;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  goto: (time: number) => void;
  toggleSkipInactive: () => void;
  triggerResize: () => void;
  $set: (props: { width?: number; height?: number }) => void;
  addEventListener: (
    event: string,
    callback: (event: { payload: unknown }) => void
  ) => void;
  removeEventListener: (
    event: string,
    callback: (event: { payload: unknown }) => void
  ) => void;
}

export interface SessionReplayState {
  // WebSocket connection
  readyState: number;
  isConnecting: boolean;
  reconnectAttempts: number;

  // Sessions
  activeSessions: Session[];
  selectedSession: string | null;
  sessionEvents: eventWithTime[];

  // Player state
  playerInstance: RRWebPlayer | null;
  playerState: PlayerState;
  isLive: boolean;

  // UI state
  loading: boolean;
  error: string | null;
  showServerStats: boolean;

  // Server stats
  serverStats: {
    totalSessions: number;
    activeSessions: number;
    totalEvents: number;
    uptime: number;
  } | null;
}

const initialState: SessionReplayState = {
  // WebSocket connection
  readyState: WebSocket.CONNECTING,
  isConnecting: false,
  reconnectAttempts: 0,

  // Sessions
  activeSessions: [],
  selectedSession: null,
  sessionEvents: [],

  // Player state
  playerInstance: null,
  playerState: {
    isPlaying: false,
    currentTime: 0,
    totalTime: 0,
    speed: 1,
    progress: 0,
    skipInactive: false,
  },
  isLive: false,

  // UI state
  loading: false,
  error: null,
  showServerStats: false,

  // Server stats
  serverStats: null,
};

export const sessionReplayStore = new Store(initialState);

// Action creators
export const sessionReplayActions = {
  // WebSocket actions
  setReadyState: (readyState: number) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      readyState,
      isConnecting: readyState === WebSocket.CONNECTING,
    }));
  },

  setReconnectAttempts: (attempts: number) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      reconnectAttempts: attempts,
    }));
  },

  // Session actions
  updateSessions: (sessions: Session[]) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      activeSessions: sessions,
    }));
  },

  addSession: (session: Session) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      activeSessions: [
        ...state.activeSessions.filter(
          (s) => s.sessionId !== session.sessionId
        ),
        session,
      ],
    }));
  },

  removeSession: (sessionId: string) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      activeSessions: state.activeSessions.filter(
        (s) => s.sessionId !== sessionId
      ),
      ...(state.selectedSession === sessionId
        ? {
            selectedSession: null,
            sessionEvents: [],
            isLive: false,
          }
        : {}),
    }));
  },

  updateSessionActivity: (
    sessionId: string,
    lastActivity: number,
    eventCount: number
  ) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      activeSessions: state.activeSessions.map((session) =>
        session.sessionId === sessionId
          ? { ...session, lastActivity, eventCount }
          : session
      ),
    }));
  },

  // Selected session actions
  setSelectedSession: (sessionId: string | null) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      selectedSession: sessionId,
      sessionEvents: sessionId ? state.sessionEvents : [],
      isLive: sessionId ? state.isLive : false,
    }));
  },

  setSessionEvents: (events: eventWithTime[]) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      sessionEvents: events,
    }));
  },

  addSessionEvents: (events: eventWithTime[]) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      sessionEvents: [...state.sessionEvents, ...events],
    }));
  },

  setIsLive: (isLive: boolean) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      isLive,
    }));
  },

  // Player actions
  setPlayerInstance: (playerInstance: RRWebPlayer | null) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      playerInstance,
    }));
  },

  updatePlayerState: (playerState: Partial<PlayerState>) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      playerState: {
        ...state.playerState,
        ...playerState,
      },
    }));
  },

  // UI actions
  setLoading: (loading: boolean) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      loading,
    }));
  },

  setError: (error: string | null) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      error,
      loading: error ? false : state.loading,
    }));
  },

  setShowServerStats: (show: boolean) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      showServerStats: show,
    }));
  },

  // Server stats actions
  updateServerStats: (stats: SessionReplayState["serverStats"]) => {
    sessionReplayStore.setState((state) => ({
      ...state,
      serverStats: stats,
    }));
  },

  // Reset actions
  reset: () => {
    sessionReplayStore.setState(initialState);
  },

  clearError: () => {
    sessionReplayStore.setState((state) => ({
      ...state,
      error: null,
    }));
  },
};

// Selectors
export const sessionReplaySelectors = {
  getActiveSessions: () => sessionReplayStore.state.activeSessions,
  getSelectedSession: () => {
    const state = sessionReplayStore.state;
    return (
      state.activeSessions.find((s) => s.sessionId === state.selectedSession) ||
      null
    );
  },
  getSelectedSessionEvents: () => sessionReplayStore.state.sessionEvents,
  getPlayerState: () => sessionReplayStore.state.playerState,
  getPlayerInstance: () => sessionReplayStore.state.playerInstance,
  getConnectionState: () => ({
    readyState: sessionReplayStore.state.readyState,
    isConnecting: sessionReplayStore.state.isConnecting,
    reconnectAttempts: sessionReplayStore.state.reconnectAttempts,
  }),
  getUIState: () => ({
    loading: sessionReplayStore.state.loading,
    error: sessionReplayStore.state.error,
    showServerStats: sessionReplayStore.state.showServerStats,
    isLive: sessionReplayStore.state.isLive,
  }),
  getServerStats: () => sessionReplayStore.state.serverStats,

  // Computed selectors
  getEventCount: () => sessionReplayStore.state.sessionEvents.length,
  getIsConnected: () => sessionReplayStore.state.readyState === WebSocket.OPEN,
  getHasSelectedSession: () =>
    sessionReplayStore.state.selectedSession !== null,
  getCanPlay: () =>
    sessionReplayStore.state.sessionEvents.length > 0 &&
    !sessionReplayStore.state.loading,
};
