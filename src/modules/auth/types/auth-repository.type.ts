import type { RefreshTokenRevokedReason } from '../../../generated/prisma/enums.js';

export type CreateLoginSessionInput = {
  adminUserId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  familyExpiresAt: Date;
};

export type RotateRefreshSessionInput = {
  sessionId: string;
  adminUserId: string;
  familyId: string;
  familyExpiresAt: Date;
  newTokenHash: string;
  newExpiresAt: Date;
  rotatedAt: Date;
};

export type RevokeFamilyInput = {
  adminUserId: string;
  familyId: string;
  revokedAt: Date;
  revokedReason: RefreshTokenRevokedReason;
};

export type RevokeAllAdminSessionsInput = {
  adminUserId: string;
  revokedAt: Date;
  revokedReason: RefreshTokenRevokedReason;
};

export type ChangePasswordAndRevokeSessionsInput = {
  adminUserId: string;
  newPasswordHash: string;
  changedAt: Date;
};
