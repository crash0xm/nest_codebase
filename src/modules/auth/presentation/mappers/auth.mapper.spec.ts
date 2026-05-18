import { AuthMapper } from './auth.mapper';
import { UserEntity } from '../../../user/domain/entities/user.entity';
import { Role } from '../../../user/domain/enums/role.enum';
import type { TokenPair } from '../../application/services/auth.service';

const mockTokenPair: TokenPair = {
  accessToken: 'access-token-xyz',
  refreshToken: 'refresh-token-xyz',
};

const mockUserPayload = {
  id: 'uuid-123',
  email: 'john@example.com',
  role: Role.USER,
  isActive: true,
};

const mockEntity = UserEntity.reconstitute({
  id: 'uuid-123',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: Role.USER,
  isActive: true,
  isEmailVerified: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
  passwordHash: 'super-secret-hash',
});

describe('AuthMapper', () => {
  describe('toAuthResponse', () => {
    it('should map tokens and user payload correctly', () => {
      const dto = AuthMapper.toAuthResponse(mockTokenPair, mockUserPayload, 900);

      expect(dto.accessToken).toBe('access-token-xyz');
      expect(dto.refreshToken).toBe('refresh-token-xyz');
      expect(dto.expiresIn).toBe(900);
      expect(dto.user.id).toBe('uuid-123');
      expect(dto.user.email).toBe('john@example.com');
      expect(dto.user.role).toBe(Role.USER);
    });

    it('should NOT include isActive in the user section', () => {
      const dto = AuthMapper.toAuthResponse(mockTokenPair, mockUserPayload, 900);
      expect(dto.user).not.toHaveProperty('isActive');
    });
  });

  describe('toMeResponse', () => {
    it('should map all required fields from domain entity', () => {
      const dto = AuthMapper.toMeResponse(mockEntity);

      expect(dto.id).toBe('uuid-123');
      expect(dto.email).toBe('john@example.com');
      expect(dto.fullName).toBe('John Doe');
      expect(dto.systemRole).toBe(Role.USER);
      expect(dto.isActive).toBe(true);
      expect(dto.isEmailVerified).toBe(true);
      expect(dto.createdAt).toEqual(new Date('2024-01-01'));
      expect(dto.updatedAt).toEqual(new Date('2024-01-01'));
    });

    it('should NOT expose passwordHash or deletedAt', () => {
      const dto = AuthMapper.toMeResponse(mockEntity);
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('deletedAt');
    });
  });
});
