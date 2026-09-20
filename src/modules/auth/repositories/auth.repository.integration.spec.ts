import { createHash, randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ConfigurationModule } from '../../../config/config.module.js';
import { PrismaModule } from '../../../database/prisma.module.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AdminUser, RefreshTokenSession } from '../../../generated/prisma/client.js';
import { AdminRole, RefreshTokenRevokedReason } from '../../../generated/prisma/enums.js';
import { AuthRepository } from './auth.repository.js';

const DAY_IN_MILLISECONDS: number = 24 * 60 * 60 * 1000;

type CreateSessionOptions = {

  tokenHash?: string;

  familyId?: string;

  expiresAt?: Date;

  familyExpiresAt?: Date;

};

describe('AuthRepository integration', () => {

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

  beforeAll(async () => {

    testingModule = await Test.createTestingModule({
      imports: [ConfigurationModule, PrismaModule],
      providers: [AuthRepository],
    }).compile();

    await testingModule.init();

    prisma = testingModule.get(PrismaService);
    authRepository = testingModule.get(AuthRepository);

  });

  afterEach(async () => {

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

  afterAll(async () => {

    await testingModule.close();

  });

  it('should find admin user by username', async () => {

    const adminUser: AdminUser = await createAdminUser();

    const foundAdminUser: AdminUser | null = await authRepository.findAdminByUsername(adminUser.username);

    expect(foundAdminUser).not.toBeNull();
    expect(foundAdminUser?.id).toBe(adminUser.id);
    expect(foundAdminUser?.username).toBe(adminUser.username);

  });

  it('should return null when admin username does not exist', async () => {

    const adminUser: AdminUser | null = await authRepository.findAdminByUsername(`missing-${randomUUID()}`);

    expect(adminUser).toBeNull();

  });

  it('should find refresh session by token hash', async () => {

    const adminUser: AdminUser = await createAdminUser();

    const tokenHash: string = createTokenHash();

    const session: RefreshTokenSession = await createSession(adminUser.id, {
      tokenHash: tokenHash,
    });

    const foundSession: RefreshTokenSession | null = await authRepository.findSessionByTokenHash(tokenHash);

    expect(foundSession).not.toBeNull();
    expect(foundSession?.id).toBe(session.id);
    expect(foundSession?.tokenHash).toBe(tokenHash);

  });

  it('should find refresh session with admin user by session id', async () => {

    const adminUser: AdminUser = await createAdminUser();

    const session: RefreshTokenSession = await createSession(adminUser.id);

    const foundSession = await authRepository.findSessionWithAdminById(session.id);

    expect(foundSession).not.toBeNull();
    expect(foundSession?.id).toBe(session.id);
    expect(foundSession?.adminUser.id).toBe(adminUser.id);
    expect(foundSession?.adminUser.username).toBe(adminUser.username);
    expect(foundSession?.adminUser.role).toBe(AdminRole.OWNER);

  });

  it('should create login session', async () => {

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

  it('should rotate refresh session', async () => {

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

  it('should reject rotation when session is already revoked', async () => {

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

  it('should reject rotation when idle session has expired', async () => {

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

  it('should reject rotation when family has expired', async () => {

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

  it('should allow only one concurrent refresh rotation', async () => {

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

  it('should revoke active sessions in one family without changing another family', async () => {

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

  it('should revoke all active sessions for one admin user only', async () => {

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

  it('should change password and revoke all active sessions in one transaction', async () => {

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

});