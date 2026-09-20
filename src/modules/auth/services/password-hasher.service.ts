import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordHasherService {

  async hashPassword(password: string): Promise<string> {

    const passwordHash: string = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    return passwordHash;

  }

  async verifyPassword(passwordHash: string, password: string): Promise<boolean> {

    const isValid: boolean = await argon2.verify(passwordHash, password);

    return isValid;

  }

}