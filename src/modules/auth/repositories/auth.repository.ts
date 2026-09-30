import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service.js';
import {
  RefreshTokenRevokedReason,
  type Prisma,
} from '../../../generated/prisma/client.js';
import type { AuthAccessSession } from '../models/access-session.model.js';
import type { AuthAdminUser } from '../models/admin-user.model.js';
import type { AuthRefreshSession } from '../models/refresh-session.model.js';
import type { AuthRefreshSessionContext } from '../models/refresh-session-context.model.js';
import type { AuthRefreshSessionState } from '../models/refresh-session-state.model.js';
import type {
  ChangePasswordAndRevokeSessionsInput,
  CreateLoginSessionInput,
  RevokeAllAdminSessionsInput,
  RevokeFamilyInput,
  RotateRefreshSessionInput,
} from '../types/auth-repository.type.js';

const adminCredentialsSelect = {
  id: true,
  username: true,
  passwordHash: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
} satisfies Prisma.AdminUserSelect;

const refreshSessionContextSelect = {
  id: true,
  adminUserId: true,
  familyId: true,
  familyExpiresAt: true,
  expiresAt: true,
  revokedAt: true,
  revokedReason: true,
  replacedById: true,
  adminUser: { select: { isActive: true } },
} satisfies Prisma.RefreshTokenSessionSelect;

const refreshSessionStateSelect = {
  expiresAt: true,
  familyExpiresAt: true,
  revokedAt: true,
  revokedReason: true,
  replacedById: true,
} satisfies Prisma.RefreshTokenSessionSelect;

const accessSessionSelect = {
  id: true,
  adminUserId: true,
  expiresAt: true,
  familyExpiresAt: true,
  revokedAt: true,
  revokedReason: true,
  replacedById: true,
  adminUser: {
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
    },
  },
} satisfies Prisma.RefreshTokenSessionSelect;

type PrismaRefreshSessionContext = Prisma.RefreshTokenSessionGetPayload<{
  select: typeof refreshSessionContextSelect;
}>;

type PrismaRefreshSessionState = Prisma.RefreshTokenSessionGetPayload<{
  select: typeof refreshSessionStateSelect;
}>;

type PrismaAccessSession = Prisma.RefreshTokenSessionGetPayload<{
  select: typeof accessSessionSelect;
}>;

@Injectable()
export class AuthRepository {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  public async findAdminByUsername(username: string): Promise<AuthAdminUser | null> {
    const adminUser: AuthAdminUser | null =
      await this.prisma.adminUser.findUnique({
        where: { username: username },
        select: adminCredentialsSelect,
      });

    return adminUser;
  }

  public async findRefreshSessionByTokenHash(tokenHash: string): Promise<AuthRefreshSessionContext | null> {
    const session: PrismaRefreshSessionContext | null =
      await this.prisma.refreshTokenSession.findUnique({
        where: { tokenHash: tokenHash },
        select: refreshSessionContextSelect,
      });

    return session;
  }

  public async findRefreshSessionStateById(sessionId: string): Promise<AuthRefreshSessionState | null> {
    const session: PrismaRefreshSessionState | null =
      await this.prisma.refreshTokenSession.findUnique({
        where: { id: sessionId },
        select: refreshSessionStateSelect,
      });

    return session;
  }

  public async findAccessSessionById(sessionId: string): Promise<AuthAccessSession | null> {
    const session: PrismaAccessSession | null =
      await this.prisma.refreshTokenSession.findUnique({
        where: { id: sessionId },
        select: accessSessionSelect,
      });

    return session;
  }

  public async createLoginSession(input: CreateLoginSessionInput): Promise<AuthRefreshSession> {
    const session: AuthRefreshSession =
      await this.prisma.refreshTokenSession.create({
        data: {
          adminUserId: input.adminUserId,
          tokenHash: input.tokenHash,
          familyId: input.familyId,
          expiresAt: input.expiresAt,
          familyExpiresAt: input.familyExpiresAt,
        },
      });

    return session;
  }

  public async rotateRefreshSession(input: RotateRefreshSessionInput): Promise<AuthRefreshSession | null> {
    return this.prisma.$transaction(
      async (
        transaction: Prisma.TransactionClient,
      ): Promise<AuthRefreshSession | null> => {
        const claimResult: Prisma.BatchPayload =
          await transaction.refreshTokenSession.updateMany({
            where: {
              id: input.sessionId,
              adminUserId: input.adminUserId,
              familyId: input.familyId,
              adminUser: { isActive: true },
              revokedAt: null,
              replacedById: null,
              expiresAt: { gt: input.rotatedAt },
              familyExpiresAt: { gt: input.rotatedAt },
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

        const newSession: AuthRefreshSession =
          await transaction.refreshTokenSession.create({
            data: {
              adminUserId: input.adminUserId,
              tokenHash: input.newTokenHash,
              familyId: input.familyId,
              familyExpiresAt: input.familyExpiresAt,
              expiresAt: input.newExpiresAt,
            },
          });

        await transaction.refreshTokenSession.update({
          where: { id: input.sessionId },
          data: { replacedById: newSession.id },
          select: { id: true },
        });

        return newSession;
      },
    );
  }

  public async revokeFamily(input: RevokeFamilyInput): Promise<number> {
    const result: Prisma.BatchPayload =
      await this.prisma.refreshTokenSession.updateMany({
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

    return result.count;
  }

  public async revokeAllAdminSessions(input: RevokeAllAdminSessionsInput): Promise<number> {
    const result: Prisma.BatchPayload =
      await this.prisma.refreshTokenSession.updateMany({
        where: { adminUserId: input.adminUserId, revokedAt: null },
        data: {
          revokedAt: input.revokedAt,
          revokedReason: input.revokedReason,
        },
      });

    return result.count;
  }

  public async changePasswordAndRevokeSessions(input: ChangePasswordAndRevokeSessionsInput): Promise<void> {
    await this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<void> => {
        await transaction.adminUser.update({
          where: { id: input.adminUserId },
          data: {
            passwordHash: input.newPasswordHash,
            mustChangePassword: false,
          },
          select: { id: true },
        });

        await transaction.refreshTokenSession.updateMany({
          where: { adminUserId: input.adminUserId, revokedAt: null },
          data: {
            revokedAt: input.changedAt,
            revokedReason: RefreshTokenRevokedReason.PASSWORD_CHANGED,
          },
        });
      },
    );
  }
}
