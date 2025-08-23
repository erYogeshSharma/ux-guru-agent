import { createSlice } from "@reduxjs/toolkit";
import { User } from "@/@types/auth";
import { api } from "@/app/services/auth.service";

type AuthState = {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  colorScheme: "light" | "dark";
  isLoading: boolean;
  error: string | null;
};

const slice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    token: null,
    refreshToken: null,
    colorScheme: "light",
    isLoading: false,
    error: null,
  } as AuthState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.error = null;
    },
    setColorScheme: (state, action) => {
      state.colorScheme = action.payload;
    },
    setTokens: (state, action) => {
      console.log({ payload: action.payload });
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Sign in
    builder.addMatcher(api.endpoints.signin.matchPending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addMatcher(
      api.endpoints.signin.matchFulfilled,
      (state, { payload }) => {
        state.token = payload.token;
        state.refreshToken = payload.refreshToken;
        state.user = payload.user;
        state.isLoading = false;
        state.error = null;
      }
    );
    builder.addMatcher(
      api.endpoints.signin.matchRejected,
      (state, { payload, error }) => {
        // payload contains the fetchBaseQuery error when available
        console.error("Sign in error:", { payload, error });
        state.isLoading = false;
        if (payload && typeof payload === "object") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p: any = payload;
          state.error =
            p.data?.message ??
            (typeof p.error === "string" ? p.error : "Sign in failed");
        } else {
          state.error = error?.message ?? "Sign in failed";
        }
      }
    );

    // Sign up
    builder.addMatcher(api.endpoints.signup.matchPending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addMatcher(
      api.endpoints.signup.matchFulfilled,
      (state, { payload }) => {
        state.token = payload.token;
        state.refreshToken = payload.refreshToken;
        state.user = payload.user;
        state.isLoading = false;
        state.error = null;
      }
    );
    builder.addMatcher(
      api.endpoints.signup.matchRejected,
      (state, { payload, error }) => {
        console.error("Sign up error:", { payload, error });
        state.isLoading = false;
        if (payload && typeof payload === "object") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p: any = payload;
          state.error =
            p.data?.message ??
            (typeof p.error === "string" ? p.error : "Sign up failed");
        } else {
          state.error = error?.message ?? "Sign up failed";
        }
      }
    );

    // Refresh token
    builder.addMatcher(
      api.endpoints.refreshToken.matchFulfilled,
      (state, { payload }) => {
        state.token = payload.token;
        state.refreshToken = payload.refreshToken;
        state.user = payload.user;
      }
    );

    // Me query
    builder.addMatcher(
      api.endpoints.me.matchFulfilled,
      (state, { payload }) => {
        state.user = payload.user;
      }
    );
  },
});

export default slice.reducer;
export const authActions = slice.actions;
