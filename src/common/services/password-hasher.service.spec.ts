import { PasswordHasherService } from './password-hasher.service';

describe('PasswordHasherService', () => {
  let service: PasswordHasherService;

  beforeEach(() => {
    service = new PasswordHasherService();
  });

  describe('hash', () => {
    it('should return a hashed string', async () => {
      const hash = await service.hash('MyP@ssw0rd!');

      expect(typeof hash).toBe('string');
      expect(hash).not.toBe('MyP@ssw0rd!');
      expect(hash.startsWith('$argon2')).toBe(true);
    });

    it('should produce different hashes for different passwords', async () => {
      const hash1 = await service.hash('password1');
      const hash2 = await service.hash('password2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verify', () => {
    it('should return true for matching password', async () => {
      const hash = await service.hash('MyP@ssw0rd!');
      const result = await service.verify(hash, 'MyP@ssw0rd!');

      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const hash = await service.hash('MyP@ssw0rd!');
      const result = await service.verify(hash, 'WrongPassword!');

      expect(result).toBe(false);
    });

    it('should reject invalid hash format', async () => {
      await expect(service.verify('not-a-valid-hash', 'password')).rejects.toThrow();
    });
  });
});
