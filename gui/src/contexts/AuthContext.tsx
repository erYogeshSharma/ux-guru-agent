import React, { createContext, useContext, ReactNode, useEffect } from "react";
import { useStore } from "@tanstack/react-store";
import {
  authStore,
  authActions,
  hasRole,
  isAdmin,
  isManager,
} from "@/store/tanstackAuthStore";
import type {
  AuthState,
  SignupRequest,
  SigninRequest,
  CreateUserRequest,
} from "@/types/auth";

interface AuthContextType extends AuthState {
  // Actions
  signup: (data: SignupRequest) => Promise<void>;
  signin: (data: SigninRequest) => Promise<void>;
  logout: () => void;
  getCurrentUser: () => Promise<void>;
  createUser: (data: CreateUserRequest) => Promise<boolean>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;

  // Helpers
  hasRole: (role: string) => boolean;
  isAdmin: () => boolean;
  isManager: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const authState = useStore(authStore);

  useEffect(() => {
    // Initialize auth state on app start
    authActions.initialize();
  }, []);

  const contextValue: AuthContextType = {
    ...authState,

    // Actions
    signup: authActions.signup,
    signin: authActions.signin,
    logout: authActions.logout,
    getCurrentUser: authActions.getCurrentUser,
    createUser: authActions.createUser,
    clearError: authActions.clearError,
    setLoading: authActions.setLoading,

    // Helpers
    hasRole,
    isAdmin,
    isManager,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
