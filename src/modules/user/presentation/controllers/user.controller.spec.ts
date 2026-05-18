import { UserController } from './user.controller';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { GetUserByIdUseCase } from '../../application/use-cases/get-user-by-id.use-case';
import { GetUsersUseCase } from '../../application/use-cases/get-users.use-case';
import { UpdateUserUseCase } from '../../application/use-cases/update-user.use-case';
import { DeleteUserUseCase } from '../../application/use-cases/delete-user.use-case';
import { UserMapper } from '../mappers/user.mapper';
import { UserEntity } from '../../domain/entities/user.entity';
import { Role } from '../../domain/enums/role.enum';
import { createTestModule } from '@/common/utils/test-helpers';

const mockEntity = UserEntity.reconstitute({
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: Role.USER,
  isActive: true,
  isEmailVerified: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
  passwordHash: 'hash',
});

describe('UserController', () => {
  let controller: UserController;
  let createUserUseCase: { execute: jest.Mock };
  let getUserByIdUseCase: { execute: jest.Mock };
  let getUsersUseCase: { execute: jest.Mock };
  let updateUserUseCase: { execute: jest.Mock };
  let deleteUserUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    const mocks = {
      createUserUseCase: { execute: jest.fn() },
      getUserByIdUseCase: { execute: jest.fn() },
      getUsersUseCase: { execute: jest.fn() },
      updateUserUseCase: { execute: jest.fn() },
      deleteUserUseCase: { execute: jest.fn() },
    };

    const module = await createTestModule({
      providers: [
        UserController,
        { provide: CreateUserUseCase, useValue: mocks.createUserUseCase },
        { provide: GetUserByIdUseCase, useValue: mocks.getUserByIdUseCase },
        { provide: GetUsersUseCase, useValue: mocks.getUsersUseCase },
        { provide: UpdateUserUseCase, useValue: mocks.updateUserUseCase },
        { provide: DeleteUserUseCase, useValue: mocks.deleteUserUseCase },
        { provide: UserMapper, useValue: UserMapper },
      ],
    });

    controller = module.get<UserController>(UserController);
    createUserUseCase = module.get(CreateUserUseCase);
    getUserByIdUseCase = module.get(GetUserByIdUseCase);
    getUsersUseCase = module.get(GetUsersUseCase);
    updateUserUseCase = module.get(UpdateUserUseCase);
    deleteUserUseCase = module.get(DeleteUserUseCase);
  });

  describe('createUser', () => {
    it('should create user and return response', async () => {
      createUserUseCase.execute.mockResolvedValue(mockEntity);
      const dto = {
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'Password123!',
        role: Role.USER,
      };

      const result = await controller.createUser(dto);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(mockEntity.id);
      expect(result.message).toBe('User created successfully');
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      getUserByIdUseCase.execute.mockResolvedValue(mockEntity);

      const result = await controller.getUserById(mockEntity.id);

      expect(result.success).toBe(true);
      expect(result.data.email).toBe('john@example.com');
    });
  });

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      getUsersUseCase.execute.mockResolvedValue({
        data: [mockEntity],
        total: 1,
        page: 1,
        limit: 10,
      });

      const result = await controller.getUsers({ page: 1, limit: 10 });

      expect(result.success).toBe(true);
      expect(result.data.data).toHaveLength(1);
      expect(result.meta?.pagination?.totalPages).toBe(1);
    });
  });

  describe('updateUser', () => {
    it('should update user and return response', async () => {
      updateUserUseCase.execute.mockResolvedValue(mockEntity);

      const result = await controller.updateUser(mockEntity.id, { firstName: 'Jane' });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(mockEntity.id);
      expect(result.message).toBe('User updated successfully');
    });
  });

  describe('deleteUser', () => {
    it('should delete user without returning body', async () => {
      deleteUserUseCase.execute.mockResolvedValue(undefined);

      const result = await controller.deleteUser(mockEntity.id);

      expect(result).toBeUndefined();
      expect(deleteUserUseCase.execute).toHaveBeenCalledWith(mockEntity.id);
    });
  });
});
