import type { RequestConfig } from "./endpoints";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
}

export class BaseApiClient {
  private baseURL: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;
  private authToken: string | null = null;

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 10000;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...config.defaultHeaders,
    };
  }

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  private getHeaders(config?: RequestConfig): HeadersInit {
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...config?.headers,
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  private buildURL(
    endpoint: string,
    params?: Record<string, string | number>
  ): string {
    const url = new URL(endpoint, this.baseURL);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    return url.toString();
  }

  async request<T = unknown>(
    method: string,
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const url = this.buildURL(endpoint, config?.params);
      const headers = this.getHeaders(config);

      const requestConfig: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(config?.timeout || this.timeout),
      };

      if (
        data &&
        (method === "POST" || method === "PUT" || method === "PATCH")
      ) {
        requestConfig.body = JSON.stringify(data);
      }

      const response = await fetch(url, requestConfig);

      // Parse response
      let responseData: unknown;
      try {
        responseData = await response.json();
      } catch {
        responseData = {};
      }

      if (!response.ok) {
        const errorMessage =
          (responseData as { message?: string })?.message ||
          `HTTP Error: ${response.status}`;
        return {
          success: false,
          error: errorMessage,
          data: responseData as T,
        };
      }

      return {
        success: true,
        data: responseData as T,
      };
    } catch (error) {
      console.error(`API Request failed (${method} ${endpoint}):`, error);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return {
            success: false,
            error: "Request timeout",
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: "Unknown error occurred",
      };
    }
  }

  // Convenience methods
  async get<T = unknown>(
    endpoint: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>("GET", endpoint, undefined, config);
  }

  async post<T = unknown>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>("POST", endpoint, data, config);
  }

  async put<T = unknown>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", endpoint, data, config);
  }

  async patch<T = unknown>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", endpoint, data, config);
  }

  async delete<T = unknown>(
    endpoint: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", endpoint, undefined, config);
  }
}
