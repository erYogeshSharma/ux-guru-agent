import { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  authActions,
  selectCurrentUser,
  selectIsAuthenticated,
  selectAuthLoading,
  selectAuthError,
} from "@/app/auth";

export const useAuth = () => {
  const user = useAppSelector(selectCurrentUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectAuthLoading);
  const error = useAppSelector(selectAuthError);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const logout = useCallback(() => {
    dispatch(authActions.logout());
    navigate("/login");
  }, [dispatch, navigate]);

  const clearError = useCallback(() => {
    dispatch(authActions.clearError());
  }, [dispatch]);

  return useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      error,
      logout,
      clearError,
    }),
    [user, isAuthenticated, isLoading, error, logout, clearError]
  );
};
