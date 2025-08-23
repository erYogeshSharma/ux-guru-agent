import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  AuthResponse,
  LoginRequest,
  SignUpRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  MeResponse,
} from "@/@types/auth";
import { BASE_API_URL } from "@/config";

export const api = createApi({
  baseQuery: fetchBaseQuery({
    baseUrl: `${BASE_API_URL}/auth`,
    prepareHeaders: async (headers, { getState }): Promise<Headers> => {
      const state = getState() as {
        auth: { token: string | null; refreshToken: string | null };
      };
      const token = state.auth.token;
      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["Auth"],
  endpoints: (builder) => ({
    signin: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: "signin",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["Auth"],
    }),

    signup: builder.mutation<AuthResponse, SignUpRequest>({
      query: (credentials) => ({
        url: "signup",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["Auth"],
    }),

    refreshToken: builder.mutation<RefreshTokenResponse, RefreshTokenRequest>({
      query: ({ refreshToken }) => ({
        url: "refresh",
        method: "POST",
        body: { refreshToken },
      }),
      invalidatesTags: ["Auth"],
    }),

    forgotPassword: builder.mutation<
      ForgotPasswordResponse,
      ForgotPasswordRequest
    >({
      query: ({ email }) => ({
        url: "forgot-password",
        method: "POST",
        body: { email },
      }),
    }),

    resetPassword: builder.mutation<
      ResetPasswordResponse,
      ResetPasswordRequest
    >({
      query: ({ token, newPassword }) => ({
        url: "reset-password",
        method: "POST",
        body: { token, newPassword },
      }),
    }),

    me: builder.query<MeResponse, void>({
      query: () => "me",
      providesTags: ["Auth"],
    }),
  }),
});

export const {
  useSigninMutation,
  useSignupMutation,
  useRefreshTokenMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useMeQuery,
} = api;
