// Authentication types matching the Fastify server
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: Organization;
}

export interface Organization {
  id: string;
  name: string;
  companyName: string;
  email: string;
}

export enum UserRole {
  ADMIN = "admin",
  MANAGER = "manager",
  USER = "user",
}

export interface SignupRequest {
  name: string;
  email: string;
  companyName: string;
  password: string;
  website?: string;
  description?: string;
}

export interface SigninRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organizationId: string;
}

export interface UserResponse {
  success: boolean;
  user?: User;
  message?: string;
}

export interface UsersResponse {
  success: boolean;
  users: User[];
  message?: string;
}

// Auth store state
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Form validation types
export interface FormErrors {
  [key: string]: string;
}

export interface SignupFormData {
  name: string;
  email: string;
  companyName: string;
  password: string;
  confirmPassword: string;
  website?: string;
  description?: string;
}

export interface SigninFormData {
  email: string;
  password: string;
}
