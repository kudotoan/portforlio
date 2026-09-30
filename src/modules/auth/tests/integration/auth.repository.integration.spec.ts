import { createHash, randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ConfigurationModule } from '../../../../config/config.module.js';
import { PrismaModule } from '../../../../database/prisma.module.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { AdminUser, RefreshTokenSession } from '../../../../generated/prisma/client.js';
import { AdminRole, RefreshTokenRevokedReason } from '../../../../generated/prisma/enums.js';
import type { AuthAdminUser } from '../../models/admin-user.model.js';
import type { AuthAccessSession } from '../../models/access-session.model.js';
import type { AuthRefreshSessionContext } from '../../models/refresh-session-context.model.js';
import type { AuthRefreshSessionState } from '../../models/refresh-session-state.model.js';
import { AuthRepository } from '../../repositories/auth.repository.js';

const DAY_IN_MILLISECONDS: number = 24 * 60 * 60 * 1000;

type CreateSessionOptions = {

  tokenHash?: string;

  familyId?: string;

  expiresAt?: Date;

  familyExpiresAt?: Date;

};

describe('AuthRepository integration', (): void => {

  let testingModule: TestingModule;

  let prisma: PrismaService;

  let authRepository: AuthRepository;

  let createdAdminUserIds: string[] = [];

  function createTokenHash(): string {

    const tokenHash: string = createHash('sha256')
      .update(randomUUID(), 'utf8')
      .digest('hex');

    return tokenHash;

  }

  async function createAdminUser(mustChangePassword: boolean = false): Promise<AdminUser> {

    const adminUser: AdminUser = await prisma.adminUser.create({
      data: {
        username: `it-${randomUUID()}`,
        passwordHash: 'integration-test-password-hash',
        role: AdminRole.OWNER,
        isActive: true,
        mustChangePassword: mustChangePassword,
      },
    });

    createdAdminUserIds.push(adminUser.id);

    return adminUser;

  }

  async function createSession(adminUserId: string, options: CreateSessionOptions = {}): Promise<RefreshTokenSession> {

    const now: Date = new Date();

    let tokenHash: string = createTokenHash();

    if (options.tokenHash !== undefined) {

      tokenHash = options.tokenHash;

    }

    let familyId: string = randomUUID();

    if (options.familyId !== undefined) {

      familyId = options.familyId;

    }

    let expiresAt: Date = new Date(now.getTime() + 7 * DAY_IN_MILLISECONDS);

    if (options.expiresAt !== undefined) {

      expiresAt = options.expiresAt;

    }

    let familyExpiresAt: Date = new Date(now.getTime() + 90 * DAY_IN_MILLISECONDS);

    if (options.familyExpiresAt !== undefined) {

      familyExpiresAt = options.familyExpiresAt;

    }

    const session: RefreshTokenSession = await authRepository.createLoginSession({
      adminUserId: adminUserId,
      tokenHash: tokenHash,
      familyId: familyId,
      expiresAt: expiresAt,
      familyExpiresAt: familyExpiresAt,
    });

    return session;

  }

  beforeAll(async (): Promise<void> => {

    testingModule = await Test.createTestingModule({
      imports: [ConfigurationModule, PrismaModule],
      providers: [AuthRepository],
    }).compile();

    await testingModule.init();

    prisma = testingModule.get(PrismaService);
    authRepository = testingModule.get(AuthRepository);

  });

  afterEach(async (): Promise<void> => {

    if (createdAdminUserIds.length === 0) {

      return;

    }

    await prisma.adminUser.deleteMany({
      where: {
        id: {
          in: createdAdminUserIds,
        },
      },
    });

    createdAdminUserIds = [];

  });

  afterAll(async (): Promise<void> => {

    await testingModule.close();

  });

  it('tim admin theo username', async (): Promise<void> => {

    const adminUser: AdminUser = await createAdminUser();

    const foundAdminUser: AuthAdminUser | null = await authRepository.findAdminByUsername(adminUser.username);

    expect(foundAdminUser).not.toBeNull();
    expect(foundAdminUser?.id).toBe(adminUser.id);
    expect(foundAdminUser?.username).toBe(adminUser.username);

  });

  it('tra null khi username khong ton tai', async (): Promise<void> => {

    const adminUser: AuthAdminUser | null = await authRepository.findAdminByUsername(`missing-${randomUUID()}`);

    expect(adminUser).toBeNull();

  });

  it('tim refresh context theo token hash va chi tra truong can thiet', async (): Promise<void> => {

    const adminUser: AdminUser = await createAdminUser();

    const tokenHash: string = createTokenHash();

    const session: RefreshTokenSession = await createSession(adminUser.id, {
      tokenHash: tokenHash,
    });

    const foundSession: AuthRefreshSessionContext | null = await authRepository.findRefreshSessionByTokenHash(tokenHash);

    expect(foundSession).not.toBeNull();
    expect(foundSession?.id).toBe(session.id);
    expect(foundSession).toEqual({
      id: session.id,
      adminUserId: adminUser.id,
      familyId: session.familyId,
      familyExpiresAt: session.familyExpiresAt,
      expiresAt: session.expiresAt,
      revokedAt: null,
      revokedReason: null,
      replacedById: null,
      adminUser: { isActive: true },
    });

  });

  it('tim trang thai refresh theo id va chi tra nam truong', async (): Promise<void> => {

    const adminUser: AdminUser = await createAdminUser();

    const session: RefreshTokenSession = await createSession(adminUser.id);

    const foundSession: AuthRefreshSessionState | null = await authRepository.findRefreshSessionStateById(session.id);

    expect(foundSession).not.toBeNull();
    expect(foundSession).toEqual({
      expiresAt: session.expiresAt,
      familyExpiresAt: session.familyExpiresAt,
      revokedAt: null,
      revokedReason: null,
      replacedById: null,
    });

  });

  it('tao login session va tra model day du', async (): Promise<void> => {

    const adminUser: AdminUser = await createAdminUser();

    const familyId: string = randomUUID();

    const tokenHash: string = createTokenHash();

    const now: Date = new Date();

    const expiresAt: Date = new Date(now.getTime() + 7 * DAY_IN_MILLISECONDS);

    const familyExpiresAt: Date = new Date(now.getTime() + 90 * DAY_IN_MILLISECONDS);

    const session: RefreshTokenSession = await authRepository.createLoginSession({
      adminUserId: adminUser.id,
      tokenHash: tokenHash,
      familyId: familyId,
      expiresAt: expiresAt,
      familyExpiresAt: familyExpiresAt,
    });

    expect(session.adminUserId).toBe(adminUser.id);
    expect(session.tokenHash).toBe(tokenHash);
    expect(session.familyId).toBe(familyId);
    expect(session.expiresAt.getTime()).toBe(expiresAt.getTime());
    expect(session.familyExpiresAt.getTime()).toBe(familyExpiresAt.getTime());
    expect(session.revokedAt).toBeNull();
    expect(session.revokedReason).toBeNull();
    expect(session.replacedById).toBeNull();
    expect(session.lastUsedAt).toBeNull();

    const savedSession: RefreshTokenSession | null = await prisma.refreshTokenSession.findUnique({
      where: {
        id: session.id,
      },
    });

    expect(savedSession).not.toBeNull();
    expect(savedSession?.id).toBe(session.id);

  });

  it('rotate refresh session va tra model day du', async (): Promise<void> => {

    const adminUser: AdminUser = await createAdminUser();

    const familyId: string = randomUUID();

    const now: Date = new Date();

    const familyExpiresAt: Date = new Date(now.getTime() + 90 * DAY_IN_MILLISECONDS);

    const currentSession: RefreshTokenSession = await createSession(adminUser.id, {
      familyId: familyId,
      familyExpiresAt: familyExpiresAt,
    });

    const rotatedAt: Date = new Date();

    const newExpiresAt: Date = new Date(rotatedAt.getTime() + 7 * DAY_IN_MILLISECONDS);

    const newTokenHash: string = createTokenHash();

    const newSession: RefreshTokenSession | null = await authRepository.rotateRefreshSession({
      sessionId: currentSession.id,
      adminUserId: adminUser.id,
      familyId: familyId,
      familyExpiresAt: familyExpiresAt,
      newTokenHash: newTokenHash,
      newExpiresAt: newExpiresAt,
      rotatedAt: rotatedAt,
    });

    expect(newSession).not.toBeNull();

    if (newSession === null) {

      throw new Error('Expected refresh session rotation to succeed.');

    }

    expect(newSession.id).not.toBe(currentSession.id);
    expect(newSession.adminUserId).toBe(adminUser.id);
    expect(newSession.familyId).toBe(familyId);
    expect(newSession.familyExpiresAt.getTime()).toBe(familyExpiresAt.getTime());
    expect(newSession.expiresAt.getTime()).toBe(newExpiresAt.getTime());
    expect(newSession.tokenHash).toBe(newTokenHash);
    expect(newSession.revokedAt).toBeNull();
    expect(newSession.revokedReason).toBeNull();
    expect(newSession.replacedById).toBeNull();

    const oldSession: RefreshTokenSession | null = await prisma.refreshTokenSession.findUnique({
      where: {
        id: currentSession.id,
      },
    });

    expect(oldSession).not.toBeNull();
    expect(oldSession?.revokedAt?.getTime()).toBe(rotatedAt.getTime());
    expect(oldSession?.lastUsedAt?.getTime()).toBe(rotatedAt.getTime());
    expect(oldSession?.revokedReason).toBe(RefreshTokenRevokedReason.ROTATED);
    expect(oldSession?.replacedById).toBe(newSession.id);

  });

  it('tu choi rotation khi session da thu hoi', async (): Promise<void> => {

    const adminUser: AdminUser = await createAdminUser();

    const session: RefreshTokenSession = await createSession(adminUser.id);

    const revokedAt: Date = new Date();

    await prisma.refreshTokenSession.update({
      where: {
        id: session.id,
      },
      data: {
        revokedAt: revokedAt,
        revokedReason: RefreshTokenRevokedReason.LOGOUT,
      },
    });

    const newSession: RefreshTokenSession | null = await authRepository.rotateRefreshSession({
      sessionId: session.id,
      adminUserId: adminUser.id,
      familyId: session.familyId,
      familyExpiresAt: session.familyExpiresAt,
      newTokenHash: createTokenHash(),
      newExpiresAt: new Date(Date.now() + 7 * DAY_IN_MILLISECONDS),
      rotatedAt: new Date(),
    });

    expect(newSession).toBeNull();

  });

  it('tu choi rotation khi session da het han', async (): Promise<void> => {

    const adminUser: AdminUser = await createAdminUser();

    const now: Date = new Date();

    const session: RefreshTokenSession = await createSession(adminUser.id, {
      expiresAt: new Date(now.getTime() - DAY_IN_MILLISECONDS),
      familyExpiresAt: new Date(now.getTime() + 30 * DAY_IN_MILLISECONDS),
    });

    const newSession: RefreshTokenSession | null = await authRepository.rotateRefreshSession({
      sessionId: session.id,
      adminUserId: adminUser.id,
      familyId: session.familyId,
      familyExpiresAt: session.familyExpiresAt,
      newTokenHash: createTokenHash(),
      newExpiresAt: new Date(now.getTime() + 7 * DAY_IN_MILLISECONDS),
      rotatedAt: now,
    });

    expect(newSession).toBeNull();

  });

  it('tu choi rotation khi family da het han', async (): Promise<void> => {

    const adminUser: AdminUser = await createAdminUser();

    const now: Date = new Date();

    const session: RefreshTokenSession = await createSession(adminUser.id, {
      expiresAt: new Date(now.getTime() + 7 * DAY_IN_MILLISECONDS),
      familyExpiresAt: new Date(now.getTime() - DAY_IN_MILLISECONDS),
    });

    const newSession: RefreshTokenSession | null = await authRepository.rotateRefreshSession({
      sessionId: session.id,
      adminUserId: adminUser.id,
      familyId: session.familyId,
      familyExpiresAt: session.familyExpiresAt,
      newTokenHash: createTokenHash(),
      newExpiresAt: new Date(now.getTime() + 7 * DAY_IN_MILLISECONDS),
      rotatedAt: now,
    });

    expect(newSession).toBeNull();

  });

  it('chi cho phep mot rotation dong thoi thanh cong', async (): Promise<void> => {

    const adminUser: AdminUser = await createAdminUser();

    const session: RefreshTokenSession = await createSession(adminUser.id);

    const rotatedAt: Date = new Date();

    const newExpiresAt: Date = new Date(rotatedAt.getTime() + 7 * DAY_IN_MILLISECONDS);

    const firstRotationPromise: Promise<RefreshTokenSession | null> = authRepository.rotateRefreshSession({
      sessionId: session.id,
      adminUserId: adminUser.id,
      familyId: session.familyId,
      familyExpiresAt: session.familyExpiresAt,
      newTokenHash: createTokenHash(),
      newExpiresAt: newExpiresAt,
      rotatedAt: rotatedAt,
    });

    const secondRotationPromise: Promise<RefreshTokenSession | null> = authRepository.rotateRefreshSession({
      sessionId: session.id,
      adminUserId: adminUser.id,
      familyId: session.familyId,
      familyExpiresAt: session.familyExpiresAt,
      newTokenHash: createTokenHash(),
      newExpiresAt: newExpiresAt,
      rotatedAt: rotatedAt,
    });

    const rotationResults: Array<RefreshTokenSession | null> = await Promise.all([
      firstRotationPromise,
      secondRotationPromise,
    ]);

    const successfulRotations: RefreshTokenSession[] = rotationResults.filter(
      (result: RefreshTokenSession | null): result is RefreshTokenSession => result !== null,
    );

    const failedRotations: null[] = rotationResults.filter(
      (result: RefreshTokenSession | null): result is null => result === null,
    );

    expect(successfulRotations).toHaveLength(1);
    expect(failedRotations).toHaveLength(1);

    const sessions: RefreshTokenSession[] = await prisma.refreshTokenSession.findMany({
      where: {
        familyId: session.familyId,
      },
    });

    expect(sessions).toHaveLength(2);

    const oldSession: RefreshTokenSession | null = await prisma.refreshTokenSession.findUnique({
      where: {
        id: session.id,
      },
    });

    expect(oldSession?.revokedReason).toBe(RefreshTokenRevokedReason.ROTATED);
    expect(oldSession?.replacedById).toBe(successfulRotations[0].id);

  });

  it('thu hoi session cua dung family', async (): Promise<void> => {

    const adminUser: AdminUser = await createAdminUser();

    const firstFamilyId: string = randomUUID();
    const secondFamilyId: string = randomUUID();

    const firstSession: RefreshTokenSession = await createSession(adminUser.id, {
      familyId: firstFamilyId,
    });

    const rotatedAt: Date = new Date();

    const replacementSession: RefreshTokenSession | null = await authRepository.rotateRefreshSession({
      sessionId: firstSession.id,
      adminUserId: adminUser.id,
      familyId: firstFamilyId,
      familyExpiresAt: firstSession.familyExpiresAt,
      newTokenHash: createTokenHash(),
      newExpiresAt: new Date(rotatedAt.getTime() + 7 * DAY_IN_MILLISECONDS),
      rotatedAt: rotatedAt,
    });

    expect(replacementSession).not.toBeNull();

    if (replacementSession === null) {

      throw new Error('Expected refresh session rotation to succeed.');

    }

    const otherFamilySession: RefreshTokenSession = await createSession(adminUser.id, {
      familyId: secondFamilyId,
    });

    const revokedAt: Date = new Date();

    const revokedSessionCount: number = await authRepository.revokeFamily({
      adminUserId: adminUser.id,
      familyId: firstFamilyId,
      revokedAt: revokedAt,
      revokedReason: RefreshTokenRevokedReason.REUSE_DETECTED,
    });

    expect(revokedSessionCount).toBe(1);

    const oldSession: RefreshTokenSession | null = await prisma.refreshTokenSession.findUnique({
      where: {
        id: firstSession.id,
      },
    });

    const activeFamilySession: RefreshTokenSession | null = await prisma.refreshTokenSession.findUnique({
      where: {
        id: replacementSession.id,
      },
    });

    const unaffectedSession: RefreshTokenSession | null = await prisma.refreshTokenSession.findUnique({
      where: {
        id: otherFamilySession.id,
      },
    });

    expect(oldSession?.revokedReason).toBe(RefreshTokenRevokedReason.ROTATED);

    expect(activeFamilySession?.revokedAt?.getTime()).toBe(revokedAt.getTime());
    expect(activeFamilySession?.revokedReason).toBe(RefreshTokenRevokedReason.REUSE_DETECTED);

    expect(unaffectedSession?.revokedAt).toBeNull();
    expect(unaffectedSession?.revokedReason).toBeNull();

  });

  it('thu hoi session cua dung admin', async (): Promise<void> => {

    const firstAdminUser: AdminUser = await createAdminUser();
    const secondAdminUser: AdminUser = await createAdminUser();

    const firstSession: RefreshTokenSession = await createSession(firstAdminUser.id);
    const secondSession: RefreshTokenSession = await createSession(firstAdminUser.id);
    const otherAdminSession: RefreshTokenSession = await createSession(secondAdminUser.id);

    const revokedAt: Date = new Date();

    const revokedSessionCount: number = await authRepository.revokeAllAdminSessions({
      adminUserId: firstAdminUser.id,
      revokedAt: revokedAt,
      revokedReason: RefreshTokenRevokedReason.PASSWORD_CHANGED,
    });

    expect(revokedSessionCount).toBe(2);

    const firstSavedSession: RefreshTokenSession | null = await prisma.refreshTokenSession.findUnique({
      where: {
        id: firstSession.id,
      },
    });

    const secondSavedSession: RefreshTokenSession | null = await prisma.refreshTokenSession.findUnique({
      where: {
        id: secondSession.id,
      },
    });

    const otherAdminSavedSession: RefreshTokenSession | null = await prisma.refreshTokenSession.findUnique({
      where: {
        id: otherAdminSession.id,
      },
    });

    expect(firstSavedSession?.revokedReason).toBe(RefreshTokenRevokedReason.PASSWORD_CHANGED);
    expect(secondSavedSession?.revokedReason).toBe(RefreshTokenRevokedReason.PASSWORD_CHANGED);

    expect(otherAdminSavedSession?.revokedAt).toBeNull();
    expect(otherAdminSavedSession?.revokedReason).toBeNull();

  });

  it('doi mat khau va thu hoi session trong mot transaction', async (): Promise<void> => {

    const adminUser: AdminUser = await createAdminUser(true);

    const firstSession: RefreshTokenSession = await createSession(adminUser.id);
    const secondSession: RefreshTokenSession = await createSession(adminUser.id);

    const newPasswordHash: string = 'new-integration-test-password-hash';

    const changedAt: Date = new Date();

    await authRepository.changePasswordAndRevokeSessions({
      adminUserId: adminUser.id,
      newPasswordHash: newPasswordHash,
      changedAt: changedAt,
    });

    const updatedAdminUser: AdminUser | null = await prisma.adminUser.findUnique({
      where: {
        id: adminUser.id,
      },
    });

    expect(updatedAdminUser).not.toBeNull();
    expect(updatedAdminUser?.passwordHash).toBe(newPasswordHash);
    expect(updatedAdminUser?.mustChangePassword).toBe(false);

    const firstSavedSession: RefreshTokenSession | null = await prisma.refreshTokenSession.findUnique({
      where: {
        id: firstSession.id,
      },
    });

    const secondSavedSession: RefreshTokenSession | null = await prisma.refreshTokenSession.findUnique({
      where: {
        id: secondSession.id,
      },
    });

    expect(firstSavedSession?.revokedAt?.getTime()).toBe(changedAt.getTime());
    expect(firstSavedSession?.revokedReason).toBe(RefreshTokenRevokedReason.PASSWORD_CHANGED);

    expect(secondSavedSession?.revokedAt?.getTime()).toBe(changedAt.getTime());
    expect(secondSavedSession?.revokedReason).toBe(RefreshTokenRevokedReason.PASSWORD_CHANGED);

  });

  it('tim access context theo session id', async (): Promise<void> => {

    const adminUser: AdminUser = await createAdminUser(true);

    const session: RefreshTokenSession =
      await createSession(adminUser.id);

    const accessSession: AuthAccessSession | null =
      await authRepository.findAccessSessionById(session.id);

    expect(accessSession).not.toBeNull();

    expect(accessSession?.id).toBe(session.id);
    expect(accessSession?.adminUserId).toBe(adminUser.id);

    expect(accessSession?.revokedAt).toBeNull();
    expect(accessSession?.revokedReason).toBeNull();
    expect(accessSession?.replacedById).toBeNull();

    expect(accessSession?.adminUser.id).toBe(adminUser.id);
    expect(accessSession?.adminUser.username).toBe(adminUser.username);
    expect(accessSession?.adminUser.role).toBe(AdminRole.OWNER);
    expect(accessSession?.adminUser.isActive).toBe(true);
    expect(accessSession?.adminUser.mustChangePassword).toBe(true);
    expect(accessSession).not.toHaveProperty('familyId');
    expect(accessSession).not.toHaveProperty('tokenHash');
    expect(accessSession?.adminUser).not.toHaveProperty('passwordHash');

  });

});