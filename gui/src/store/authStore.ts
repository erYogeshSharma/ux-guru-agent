import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "@/api/client";
import type { AuthState, SignupRequest, SigninRequest } from "@/types/auth";

interface AuthActions {
  signup: (data: SignupRequest) => Promise<void>;
  signin: (data: SigninRequest) => Promise<void>;
  logout: () => void;
  getCurrentUser: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      signup: async (data: SignupRequest) => {
        try {
          set({ isLoading: true, error: null });

          const response = await apiClient.signup(data);

          if (response.success && response.token && response.user) {
            // Set auth token in API client
            apiClient.setAuthToken(response.token);

            set({
              user: response.user,
              token: response.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            set({
              isLoading: false,
              error: response.message || "Signup failed",
            });
          }
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Signup failed",
          });
        }
      },

      signin: async (data: SigninRequest) => {
        try {
          set({ isLoading: true, error: null });

          const response = await apiClient.signin(data);

          if (response.success && response.token && response.user) {
            // Set auth token in API client
            apiClient.setAuthToken(response.token);

            set({
              user: response.user,
              token: response.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            set({
              isLoading: false,
              error: response.message || "Sign in failed",
            });
          }
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Sign in failed",
          });
        }
      },

      logout: () => {
        // Clear auth token from API client
        apiClient.setAuthToken(null);

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      getCurrentUser: async () => {
        try {
          const state = get();
          if (!state.token) {
            return;
          }

          set({ isLoading: true });

          const response = await apiClient.getCurrentUser();

          if (response.success && response.user) {
            set({
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            // Token might be invalid, logout
            get().logout();
          }
        } catch (error) {
          // Token might be invalid, logout
          get().logout();
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: "auth-store",
      // Only persist user, token, and isAuthenticated
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      // Rehydrate API client with token on load
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          apiClient.setAuthToken(state.token);
        }
      },
    }
  )
);

// Initialize auth on app load
export const initializeAuth = async () => {
  const { token, getCurrentUser } = useAuthStore.getState();
  if (token) {
    await getCurrentUser();
  }
};
