import { createApi } from "@reduxjs/toolkit/query/react";
import baseQueryWithReauth from "./queryUtils";
import { MeResponse } from "@/@types/auth";
import { SessionResponse } from "@/@types/session";

export const sessionAPI = createApi({
  reducerPath: "session",
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getSessionsList: builder.query<SessionResponse, void>({
      query: () => ({
        url: "/sessions",
        method: "GET",
      }),
    }),
    getActiveSessionsList: builder.query<SessionResponse, void>({
      query: () => ({
        url: "/active",
        method: "GET",
      }),
    }),

    getSessionEvents: builder.query<MeResponse, string>({
      query: (sessionId) => ({
        url: `/events/${sessionId}/events`,
        method: "GET",
      }),
    }),
  }),
});

export const {
  useGetSessionsListQuery,
  useGetActiveSessionsListQuery,
  useGetSessionEventsQuery,
} = sessionAPI;
