import { createApi } from "@reduxjs/toolkit/query/react";
import baseQueryWithReauth from "./queryUtils";
import { MeResponse } from "@/@types/auth";

export const userAPI = createApi({
  reducerPath: "userAPI",
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getProfile: builder.query<MeResponse, void>({
      query: () => ({
        url: "auth/me",
        method: "GET",
      }),
    }),
  }),
});

export const { useGetProfileQuery } = userAPI;
