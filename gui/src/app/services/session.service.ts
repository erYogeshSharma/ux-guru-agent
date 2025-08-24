import { createApi } from "@reduxjs/toolkit/query/react";
import baseQueryWithReauth from "./queryUtils";
import { SessionEventsResponse, SessionResponse } from "@/@types/session";

interface SessionsQueryParams {
  page?: number;
  limit?: number;
}

export const sessionAPI = createApi({
  reducerPath: "session",
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getSessionsList: builder.query<SessionResponse, SessionsQueryParams>({
      query: ({ page = 1, limit = 20 } = {}) => ({
        url: "/sessions",
        method: "GET",
        params: { page, limit },
      }),
    }),
    getActiveSessionsList: builder.query<SessionResponse, void>({
      query: () => ({
        url: "/active",
        method: "GET",
      }),
    }),

    getSessionEvents: builder.query<
      SessionEventsResponse,
      { sessionId: string; page: number; limit: number }
    >({
      query: ({ sessionId, page = 1, limit = 100 }) => ({
        url: `/sessions/${sessionId}/events`,
        method: "GET",
        params: { page, limit },
      }),
    }),
  }),
});

export const {
  useGetSessionsListQuery,
  useGetActiveSessionsListQuery,
  useGetSessionEventsQuery,
} = sessionAPI;
