import type { RefreshTokenRevokedReason } from '../../../generated/prisma/enums.js';

export type AuthRefreshSessionContext = {
  id: string;
  adminUserId: string;
  familyId: string;
  familyExpiresAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: RefreshTokenRevokedReason | null;
  replacedById: string | null;
  adminUser: {
    isActive: boolean;
  };
};
