export type Organization = {
  id: string;
  name: string;
  companyName: string;
  email: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  organization: Organization;
};

export type AuthResponse = {
  success: boolean;
  token: string;
  refreshToken: string;
  user: User;
};

export type RefreshTokenResponse = {
  success: boolean;
  token: string;
  refreshToken: string;
  user: User;
};

export type ForgotPasswordResponse = {
  success: boolean;
  message: string;
  resetLink: string;
};

export type ResetPasswordResponse = {
  success: boolean;
  message: string;
};

export type MeResponse = {
  success: boolean;
  user: User;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type SignUpRequest = {
  name: string;
  email: string;
  password: string;
  companyName: string;
};

export type RefreshTokenRequest = {
  refreshToken: string;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type ResetPasswordRequest = {
  token: string;
  newPassword: string;
};
