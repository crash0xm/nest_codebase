import { UserMapper } from './user.mapper';
import { UserEntity } from '../../domain/entities/user.entity';
import { Role } from '../../domain/enums/role.enum';

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

describe('UserMapper', () => {
  describe('toResponse', () => {
    it('should map all required fields', () => {
      const dto = UserMapper.toResponse(mockEntity);

      expect(dto.id).toBe('uuid-123');
      expect(dto.email).toBe('john@example.com');
      expect(dto.firstName).toBe('John');
      expect(dto.lastName).toBe('Doe');
      expect(dto.fullName).toBe('John Doe');
      expect(dto.role).toBe(Role.USER);
      expect(dto.isActive).toBe(true);
      expect(dto.isEmailVerified).toBe(true);
      expect(dto.createdAt).toEqual(new Date('2024-01-01'));
      expect(dto.updatedAt).toEqual(new Date('2024-01-01'));
    });

    it('should NOT expose passwordHash', () => {
      const dto = UserMapper.toResponse(mockEntity);
      expect(dto).not.toHaveProperty('passwordHash');
    });

    it('should NOT expose deletedAt', () => {
      const dto = UserMapper.toResponse(mockEntity);
      expect(dto).not.toHaveProperty('deletedAt');
    });
  });

  describe('toSummary', () => {
    it('should only expose summary fields', () => {
      const dto = UserMapper.toSummary(mockEntity);

      expect(Object.keys(dto)).toEqual(['id', 'email', 'fullName', 'role']);
    });

    it('should NOT expose sensitive or unnecessary fields', () => {
      const dto = UserMapper.toSummary(mockEntity);

      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('isActive');
      expect(dto).not.toHaveProperty('isEmailVerified');
      expect(dto).not.toHaveProperty('createdAt');
      expect(dto).not.toHaveProperty('updatedAt');
    });
  });

  describe('toPaginatedResponse', () => {
    it('should calculate totalPages from data', () => {
      const result = UserMapper.toPaginatedResponse({
        data: [mockEntity, mockEntity],
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
      });

      expect(result.totalPages).toBe(3);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(false);
    });

    it('should map each item as summary', () => {
      const result = UserMapper.toPaginatedResponse({
        data: [mockEntity],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });

      expect(result.data[0]).toEqual({
        id: 'uuid-123',
        email: 'john@example.com',
        fullName: 'John Doe',
        role: Role.USER,
      });
    });
  });
});
