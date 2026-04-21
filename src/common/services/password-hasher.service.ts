import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export const PASSWORD_HASHER = 'PASSWORD_HASHER';

@Injectable()
export class PasswordHasherService implements IPasswordHasher {
  async hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
