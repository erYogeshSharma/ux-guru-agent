import { jwtDecode } from "jwt-decode";
import { BASE_API_URL } from "@/config";
import { authActions } from "@/app/features/auth.slice";
import { RootState, store } from "../store";
import { RefreshTokenResponse } from "@/@types/auth";

async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshTokenResponse | null> {
  try {
    const response = await fetch(`${BASE_API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error("Failed to refresh token");
    }

    const data: RefreshTokenResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Token refresh failed", error);
    return null;
  }
}

export async function checkToken(headers: Headers, getState: () => RootState) {
  const state = getState() as RootState;
  const token = state.auth.token;
  const refreshToken = state.auth.refreshToken;

  if (token) {
    const decodedToken = jwtDecode<{ exp: number }>(token);
    const currentTime = Date.now() / 1000;

    if (decodedToken.exp > currentTime) {
      headers.set("authorization", `Bearer ${token}`);
      return headers;
    }
  }

  // Token expired: Try to refresh
  if (refreshToken) {
    const refreshResult = await refreshAccessToken(refreshToken);
    if (refreshResult && refreshResult.success) {
      store.dispatch(
        authActions.setTokens({
          token: refreshResult.token,
          refreshToken: refreshResult.refreshToken,
        })
      );
      headers.set("authorization", `Bearer ${refreshResult.token}`);
    } else {
      // Refresh failed, logout user
      store.dispatch(authActions.logout());
    }
  }

  return headers;
}

export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch {
    return true;
  }
};
