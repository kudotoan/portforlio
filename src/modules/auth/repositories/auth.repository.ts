import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service.js';
import { RefreshTokenRevokedReason, type AdminUser, type Prisma, type RefreshTokenSession } from '../../../generated/prisma/client.js';

export type RefreshTokenSessionWithAdmin = Prisma.RefreshTokenSessionGetPayload<{
  include: {
    adminUser: true;
  };
}>;

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

@Injectable()
export class AuthRepository {

  constructor(private readonly prisma: PrismaService) {

  }

  async findAdminByUsername(username: string): Promise<AdminUser | null> {

    const adminUser: AdminUser | null = await this.prisma.adminUser.findUnique({
      where: {
        username: username,
      },
    });

    return adminUser;

  }

  async findSessionByTokenHash(tokenHash: string): Promise<RefreshTokenSession | null> {

    const refreshTokenSession: RefreshTokenSession | null = await this.prisma.refreshTokenSession.findUnique({
      where: {
        tokenHash: tokenHash,
      },
    });

    return refreshTokenSession;

  }

  async findSessionWithAdminById(sessionId: string): Promise<RefreshTokenSessionWithAdmin | null> {

    const refreshTokenSession: RefreshTokenSessionWithAdmin | null = await this.prisma.refreshTokenSession.findUnique({
      where: {
        id: sessionId,
      },
      include: {
        adminUser: true,
      },
    });

    return refreshTokenSession;

  }

    async createLoginSession(input: CreateLoginSessionInput): Promise<RefreshTokenSession> {

        const refreshTokenSession: RefreshTokenSession = await this.prisma.refreshTokenSession.create({
            data: {
            adminUserId: input.adminUserId,
            tokenHash: input.tokenHash,
            familyId: input.familyId,
            expiresAt: input.expiresAt,
            familyExpiresAt: input.familyExpiresAt,
            },
        });

        return refreshTokenSession;

    }

    async rotateRefreshSession(input: RotateRefreshSessionInput): Promise<RefreshTokenSession | null> {

        const replacementSession: RefreshTokenSession | null = await this.prisma.$transaction(async (transaction) => {

            const claimResult: Prisma.BatchPayload = await transaction.refreshTokenSession.updateMany({
            where: {
                id: input.sessionId,
                adminUserId: input.adminUserId,
                familyId: input.familyId,
                adminUser: {
                isActive: true,
                },
                revokedAt: null,
                replacedById: null,
                expiresAt: {
                gt: input.rotatedAt,
                },
                familyExpiresAt: {
                gt: input.rotatedAt,
                },
            },
            data: {
                revokedAt: input.rotatedAt,
                revokedReason: RefreshTokenRevokedReason.ROTATED,
                lastUsedAt: input.rotatedAt,
            },
            });

            if (claimResult.count !== 1) {

            return null;

            }

            const newSession: RefreshTokenSession = await transaction.refreshTokenSession.create({
            data: {
                adminUserId: input.adminUserId,
                tokenHash: input.newTokenHash,
                familyId: input.familyId,
                familyExpiresAt: input.familyExpiresAt,
                expiresAt: input.newExpiresAt,
            },
            });

            await transaction.refreshTokenSession.update({
            where: {
                id: input.sessionId,
            },
            data: {
                replacedById: newSession.id,
            },
            });

            return newSession;

        });

        return replacementSession;

    }

    async revokeFamily(input: RevokeFamilyInput): Promise<number> {

        const revokeResult: Prisma.BatchPayload = await this.prisma.refreshTokenSession.updateMany({
            where: {
            adminUserId: input.adminUserId,
            familyId: input.familyId,
            revokedAt: null,
            },
            data: {
            revokedAt: input.revokedAt,
            revokedReason: input.revokedReason,
            },
        });

        return revokeResult.count;

    }

    async revokeAllAdminSessions(input: RevokeAllAdminSessionsInput): Promise<number> {

        const revokeResult: Prisma.BatchPayload = await this.prisma.refreshTokenSession.updateMany({
            where: {
            adminUserId: input.adminUserId,
            revokedAt: null,
            },
            data: {
            revokedAt: input.revokedAt,
            revokedReason: input.revokedReason,
            },
        });

        return revokeResult.count;

    }
    async changePasswordAndRevokeSessions(input: ChangePasswordAndRevokeSessionsInput): Promise<void> {

        await this.prisma.$transaction(async (transaction) => {

            await transaction.adminUser.update({
            where: {
                id: input.adminUserId,
            },
            data: {
                passwordHash: input.newPasswordHash,
                mustChangePassword: false,
            },
            });

            await transaction.refreshTokenSession.updateMany({
            where: {
                adminUserId: input.adminUserId,
                revokedAt: null,
            },
            data: {
                revokedAt: input.changedAt,
                revokedReason: RefreshTokenRevokedReason.PASSWORD_CHANGED,
            },
            });

        });

    }
}