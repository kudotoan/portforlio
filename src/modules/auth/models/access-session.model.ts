import type {
  AdminRole,
  RefreshTokenRevokedReason,
} from '../../../generated/prisma/enums.js';

export type AuthAccessSession = {
  id: string;
  adminUserId: string;

  expiresAt: Date;
  familyExpiresAt: Date;

  revokedAt: Date | null;
  revokedReason: RefreshTokenRevokedReason | null;

  replacedById: string | null;

  adminUser: {
    id: string;
    username: string;
    role: AdminRole;
    isActive: boolean;
    mustChangePassword: boolean;
  };
};