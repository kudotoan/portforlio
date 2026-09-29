import type { RefreshTokenRevokedReason } from '../../../generated/prisma/enums.js';

import type { AuthAdminUser } from './admin-user.model.js';

export type AuthRefreshSession = {
  id: string;
  adminUserId: string;
  tokenHash: string;
  familyId: string;
  familyExpiresAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: RefreshTokenRevokedReason | null;
  replacedById: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export type AuthRefreshSessionWithAdmin = AuthRefreshSession & {
  adminUser: AuthAdminUser;
};
