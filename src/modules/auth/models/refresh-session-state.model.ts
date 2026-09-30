import type { RefreshTokenRevokedReason } from '../../../generated/prisma/enums.js';

export type AuthRefreshSessionState = {
  expiresAt: Date;
  familyExpiresAt: Date;
  revokedAt: Date | null;
  revokedReason: RefreshTokenRevokedReason | null;
  replacedById: string | null;
};
