import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service.js';
import { RefreshTokenRevokedReason, type AdminUser as PrismaAdminUser, type Prisma, type RefreshTokenSession as PrismaRefreshTokenSession } from '../../../generated/prisma/client.js';
import type { AuthAdminUser } from '../models/admin-user.model.js';
import type { AuthRefreshSession, AuthRefreshSessionWithAdmin } from '../models/refresh-session.model.js';

type PrismaRefreshSessionWithAdmin = Prisma.RefreshTokenSessionGetPayload<{
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

  async findAdminByUsername(username: string): Promise<AuthAdminUser | null> {

    const adminUser: PrismaAdminUser | null = await this.prisma.adminUser.findUnique({
      where: {
        username: username,
      },
    });

    return adminUser === null ? null : this.toAuthAdminUser(adminUser);

  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthRefreshSession | null> {

    const refreshTokenSession: PrismaRefreshTokenSession | null = await this.prisma.refreshTokenSession.findUnique({
      where: {
        tokenHash: tokenHash,
      },
    });

    return refreshTokenSession === null ? null : this.toAuthRefreshSession(refreshTokenSession);

  }

  async findSessionWithAdminById(sessionId: string): Promise<AuthRefreshSessionWithAdmin | null> {

    const refreshTokenSession: PrismaRefreshSessionWithAdmin | null = await this.prisma.refreshTokenSession.findUnique({
      where: {
        id: sessionId,
      },
      include: {
        adminUser: true,
      },
    });

    if (refreshTokenSession === null) {
      return null;
    }

    return {
      ...this.toAuthRefreshSession(refreshTokenSession),
      adminUser: this.toAuthAdminUser(refreshTokenSession.adminUser),
    };

  }

    async createLoginSession(input: CreateLoginSessionInput): Promise<AuthRefreshSession> {

        const refreshTokenSession: PrismaRefreshTokenSession = await this.prisma.refreshTokenSession.create({
            data: {
            adminUserId: input.adminUserId,
            tokenHash: input.tokenHash,
            familyId: input.familyId,
            expiresAt: input.expiresAt,
            familyExpiresAt: input.familyExpiresAt,
            },
        });

        return this.toAuthRefreshSession(refreshTokenSession);

    }

    async rotateRefreshSession(input: RotateRefreshSessionInput): Promise<AuthRefreshSession | null> {

        const replacementSession: PrismaRefreshTokenSession | null = await this.prisma.$transaction(async (transaction) => {

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

            const newSession: PrismaRefreshTokenSession = await transaction.refreshTokenSession.create({
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

        return replacementSession === null ? null : this.toAuthRefreshSession(replacementSession);

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

    private toAuthAdminUser(row: PrismaAdminUser): AuthAdminUser {
      return {
        id: row.id,
        username: row.username,
        passwordHash: row.passwordHash,
        role: row.role,
        isActive: row.isActive,
        mustChangePassword: row.mustChangePassword,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }

    private toAuthRefreshSession(row: PrismaRefreshTokenSession): AuthRefreshSession {
      return {
        id: row.id,
        adminUserId: row.adminUserId,
        tokenHash: row.tokenHash,
        familyId: row.familyId,
        familyExpiresAt: row.familyExpiresAt,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        revokedReason: row.revokedReason,
        replacedById: row.replacedById,
        lastUsedAt: row.lastUsedAt,
        createdAt: row.createdAt,
      };
    }
}