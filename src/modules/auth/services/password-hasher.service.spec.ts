import { describe, expect, it } from 'vitest';

import { PasswordHasherService } from './password-hasher.service.js';

describe('PasswordHasherService', () => {

  const passwordHasherService: PasswordHasherService = new PasswordHasherService();

  it('should hash password', async () => {

    const password: string = 'StrongPassword123!';
    const passwordHash: string = await passwordHasherService.hashPassword(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash.startsWith('$argon2id$')).toBe(true);

  });

  it('should verify correct password', async () => {

    const password: string = 'StrongPassword123!';
    const passwordHash: string = await passwordHasherService.hashPassword(password);

    const isValid: boolean = await passwordHasherService.verifyPassword(passwordHash, password);

    expect(isValid).toBe(true);

  });

  it('should reject incorrect password', async () => {

    const passwordHash: string = await passwordHasherService.hashPassword('StrongPassword123!');

    const isValid: boolean = await passwordHasherService.verifyPassword(passwordHash, 'WrongPassword123!');

    expect(isValid).toBe(false);

  });

});