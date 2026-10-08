import type { AuthAdminUser } from '../models/admin-user.model.js';

export type LoginInput = {
  username: string;
  password: string;
};

export type AuthAdminResult = Pick<
  AuthAdminUser,
  'id' | 'username' | 'role' | 'mustChangePassword'
>;

export type LoginResult = {
  accessToken: string;
  expiresIn: number;
  admin: AuthAdminResult;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

export type RefreshResult = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

export type ChangePasswordInput = {
  adminUserId: string;
  username: string;
  currentPassword: string;
  newPassword: string;
};