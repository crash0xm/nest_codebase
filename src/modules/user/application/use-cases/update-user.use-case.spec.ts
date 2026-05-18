import { UpdateUserUseCase } from './update-user.use-case';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserNotFoundException } from '@/common/domain/errors/application.error';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { CacheKeys } from '@/constants/cache.constant';
import { createTestModule } from '@/common/utils/test-helpers';
import { UserEntity } from '../../domain/entities/user.entity';
import { Role } from '../../domain/enums/role.enum';
import { UpdateUserDto } from '../../domain/repositories/user.repository.interface';

describe('UpdateUserUseCase', () => {
  let useCase: UpdateUserUseCase;
  let userRepo: Record<string, jest.Mock>;
  let cache: Record<string, jest.Mock>;
  let eventEmitter: Record<string, jest.Mock>;

  const existingUser = UserEntity.reconstitute({
    id: 'user-1',
    email: 'old@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: Role.USER,
    isActive: true,
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    passwordHash: 'hash',
  });

  const updatedUser = UserEntity.reconstitute({
    id: 'user-1',
    email: 'old@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    role: Role.ADMIN,
    isActive: true,
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    passwordHash: 'hash',
  });

  beforeEach(async () => {
    userRepo = {
      findById: jest.fn(),
      update: jest.fn(),
    };
    cache = {
      del: jest.fn().mockResolvedValue(undefined),
    };
    eventEmitter = {
      emit: jest.fn(),
    };

    const module = await createTestModule({
      providers: [
        UpdateUserUseCase,
        { provide: INJECTION_TOKENS.USER_REPOSITORY, useValue: userRepo },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    });

    useCase = module.get<UpdateUserUseCase>(UpdateUserUseCase);
  });

  it('should update user, invalidate cache, and emit event', async () => {
    userRepo.findById.mockResolvedValue(existingUser);
    userRepo.update.mockResolvedValue(updatedUser);

    const dto: UpdateUserDto = { firstName: 'Jane', lastName: 'Smith', role: Role.ADMIN };
    const result = await useCase.execute('user-1', dto);

    expect(result.firstName).toBe('Jane');
    expect(userRepo.findById).toHaveBeenCalledWith('user-1');
    expect(userRepo.update).toHaveBeenCalledWith('user-1', dto);
    expect(cache.del).toHaveBeenCalledWith(CacheKeys.user('user-1'));
    expect(cache.del).toHaveBeenCalledWith(CacheKeys.userByEmail('old@example.com'));
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'user.updated',
      expect.objectContaining({
        userId: 'user-1',
        email: 'old@example.com',
      }),
    );
  });

  it('should throw UserNotFoundException if user does not exist', async () => {
    userRepo.findById.mockResolvedValue(null);

    const dto: UpdateUserDto = { firstName: 'Jane' };
    await expect(useCase.execute('non-existent', dto)).rejects.toThrow(UserNotFoundException);
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('should still emit event even if cache invalidation fails', async () => {
    userRepo.findById.mockResolvedValue(existingUser);
    userRepo.update.mockResolvedValue(updatedUser);
    cache.del.mockRejectedValue(new Error('Cache down'));

    await expect(useCase.execute('user-1', { firstName: 'Jane' })).resolves.not.toThrow();
    expect(eventEmitter.emit).toHaveBeenCalled();
  });

  it('should clear user list cache pattern', async () => {
    userRepo.findById.mockResolvedValue(existingUser);
    userRepo.update.mockResolvedValue(updatedUser);

    await useCase.execute('user-1', { firstName: 'Jane' });

    expect(cache.del).toHaveBeenCalledWith('users:list:*');
  });
});
