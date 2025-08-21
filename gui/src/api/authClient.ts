import { BaseApiClient } from "./baseClient";
import { API_ENDPOINTS } from "./endpoints";
import type {
  SignupRequest,
  SigninRequest,
  CreateUserRequest,
  AuthResponse,
  UserResponse,
  UsersResponse,
} from "@/types/auth";

export class AuthApiClient extends BaseApiClient {
  async signup(data: SignupRequest): Promise<AuthResponse> {
    const response = await this.post<AuthResponse>(
      API_ENDPOINTS.AUTH.SIGNUP,
      data
    );
    return response.data || { success: false };
  }

  async signin(data: SigninRequest): Promise<AuthResponse> {
    const response = await this.post<AuthResponse>(
      API_ENDPOINTS.AUTH.SIGNIN,
      data
    );
    return response.data || { success: false };
  }

  async getCurrentUser(): Promise<UserResponse> {
    const response = await this.get<UserResponse>(API_ENDPOINTS.AUTH.ME);
    return response.data || { success: false };
  }

  async createUser(data: CreateUserRequest): Promise<AuthResponse> {
    const response = await this.post<AuthResponse>(
      API_ENDPOINTS.AUTH.USERS,
      data
    );
    return response.data || { success: false };
  }

  async getUsers(): Promise<UsersResponse> {
    const response = await this.get<UsersResponse>(API_ENDPOINTS.AUTH.USERS);
    return response.data || { success: false, users: [] };
  }

  async refreshToken(): Promise<AuthResponse> {
    const response = await this.post<AuthResponse>(API_ENDPOINTS.AUTH.REFRESH);
    return response.data || { success: false };
  }
}
