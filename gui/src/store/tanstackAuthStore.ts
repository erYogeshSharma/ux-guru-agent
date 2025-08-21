import { Store } from "@tanstack/store";
import { apiClient } from "@/api/client";
import type {
  AuthState,
  SignupRequest,
  SigninRequest,
  CreateUserRequest,
} from "@/types/auth";

// Initial auth state
const initialAuthState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Load state from localStorage
function loadStateFromStorage(): AuthState {
  try {
    const stored = localStorage.getItem("auth-storage");
    if (stored) {
      const parsed = JSON.parse(stored);
      const state = parsed.state || initialAuthState;

      // Validate the stored state
      if (state.token && state.user) {
        // Set token in API client
        apiClient.setAuthToken(state.token);
        return {
          ...state,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        };
      }
    }
  } catch (error) {
    console.warn("Failed to load auth state from storage:", error);
  }

  return initialAuthState;
}

// Save state to localStorage
function saveStateToStorage(state: AuthState) {
  try {
    localStorage.setItem("auth-storage", JSON.stringify({ state }));
  } catch (error) {
    console.warn("Failed to save auth state to storage:", error);
  }
}

// Create the store
export const authStore = new Store(loadStateFromStorage());

// Subscribe to store changes to persist them
authStore.subscribe(() => {
  const state = authStore.state;
  saveStateToStorage(state);
});

// ===== Auth Actions =====

export const authActions = {
  // Set loading state
  setLoading: (loading: boolean) => {
    authStore.setState((state) => ({
      ...state,
      isLoading: loading,
    }));
  },

  // Set error
  setError: (error: string | null) => {
    authStore.setState((state) => ({
      ...state,
      error,
      isLoading: false,
    }));
  },

  // Clear error
  clearError: () => {
    authStore.setState((state) => ({
      ...state,
      error: null,
    }));
  },

  // Sign up
  signup: async (data: SignupRequest): Promise<void> => {
    try {
      authActions.setLoading(true);
      authActions.clearError();

      const response = await apiClient.signup(data);

      if (response.success && response.token && response.user) {
        // Set auth token in API client
        apiClient.setAuthToken(response.token);

        authStore.setState({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        authActions.setError(response.message || "Signup failed");
      }
    } catch (error) {
      console.error("Signup error:", error);
      authActions.setError(
        error instanceof Error ? error.message : "Signup failed"
      );
    }
  },

  // Sign in
  signin: async (data: SigninRequest): Promise<void> => {
    try {
      authActions.setLoading(true);
      authActions.clearError();

      const response = await apiClient.signin(data);

      if (response.success && response.token && response.user) {
        // Set auth token in API client
        apiClient.setAuthToken(response.token);

        authStore.setState({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        authActions.setError(response.message || "Sign in failed");
      }
    } catch (error) {
      console.error("Signin error:", error);
      authActions.setError(
        error instanceof Error ? error.message : "Sign in failed"
      );
    }
  },

  // Get current user (for token validation)
  getCurrentUser: async (): Promise<void> => {
    try {
      authActions.setLoading(true);
      authActions.clearError();

      const response = await apiClient.getCurrentUser();

      if (response.success && response.user) {
        authStore.setState((state) => ({
          ...state,
          user: response.user!,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        }));
      } else {
        // Invalid token, logout
        authActions.logout();
      }
    } catch (error) {
      console.error("Get current user error:", error);
      // If we can't get current user, probably invalid token
      authActions.logout();
    }
  },

  // Create user (admin/manager only)
  createUser: async (data: CreateUserRequest): Promise<boolean> => {
    try {
      authActions.setLoading(true);
      authActions.clearError();

      const response = await apiClient.createUser(data);

      if (response.success) {
        authActions.setLoading(false);
        return true;
      } else {
        authActions.setError(response.message || "User creation failed");
        return false;
      }
    } catch (error) {
      console.error("Create user error:", error);
      authActions.setError(
        error instanceof Error ? error.message : "User creation failed"
      );
      return false;
    }
  },

  // Logout
  logout: () => {
    // Clear token from API client
    apiClient.setAuthToken(null);

    // Reset store state
    authStore.setState(initialAuthState);

    // Clear localStorage
    localStorage.removeItem("auth-storage");
  },

  // Initialize auth state on app start
  initialize: async (): Promise<void> => {
    const currentState = authStore.state;

    // If we have a token but no user validation, verify the token
    if (currentState.token && !currentState.user) {
      await authActions.getCurrentUser();
    }
  },
};

// Helper to check if user has specific role
export const hasRole = (requiredRole: string): boolean => {
  const user = authStore.state.user;
  if (!user) return false;

  const roleHierarchy = ["user", "manager", "admin"];
  const userRoleIndex = roleHierarchy.indexOf(user.role);
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

  return userRoleIndex >= requiredRoleIndex;
};

// Helper to check if user is admin
export const isAdmin = (): boolean => hasRole("admin");

// Helper to check if user is manager or admin
export const isManager = (): boolean => hasRole("manager");
