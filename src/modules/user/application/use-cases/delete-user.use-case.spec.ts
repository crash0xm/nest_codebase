import { DeleteUserUseCase } from './delete-user.use-case';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserNotFoundException } from '@/common/domain/errors/application.error';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { CacheKeys } from '@/constants/cache.constant';
import { createTestModule } from '@/common/utils/test-helpers';
import { UserEntity } from '../../domain/entities/user.entity';
import { Role } from '../../domain/enums/role.enum';

describe('DeleteUserUseCase', () => {
  let useCase: DeleteUserUseCase;
  let userRepo: Record<string, jest.Mock>;
  let cache: Record<string, jest.Mock>;
  let tokenStore: Record<string, jest.Mock>;
  let eventEmitter: Record<string, jest.Mock>;

  const existingUser = UserEntity.reconstitute({
    id: 'user-1',
    email: 'test@example.com',
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

  beforeEach(async () => {
    userRepo = {
      findById: jest.fn(),
      deactivate: jest.fn(),
    };
    cache = {
      del: jest.fn().mockResolvedValue(undefined),
    };
    tokenStore = {
      revokeAll: jest.fn().mockResolvedValue(undefined),
    };
    eventEmitter = {
      emit: jest.fn(),
    };

    const module = await createTestModule({
      providers: [
        DeleteUserUseCase,
        { provide: INJECTION_TOKENS.USER_REPOSITORY, useValue: userRepo },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: INJECTION_TOKENS.TOKEN_STORE, useValue: tokenStore },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    });

    useCase = module.get<DeleteUserUseCase>(DeleteUserUseCase);
  });

  it('should soft delete user, revoke sessions, clear cache, and emit event', async () => {
    userRepo.findById.mockResolvedValue(existingUser);

    await useCase.execute('user-1');

    expect(userRepo.findById).toHaveBeenCalledWith('user-1');
    expect(userRepo.deactivate).toHaveBeenCalledWith('user-1');
    expect(tokenStore.revokeAll).toHaveBeenCalledWith('user-1');
    expect(cache.del).toHaveBeenCalledWith(CacheKeys.user('user-1'));
    expect(cache.del).toHaveBeenCalledWith(CacheKeys.userByEmail('test@example.com'));
    expect(eventEmitter.emit).toHaveBeenCalledWith('user.deleted', {
      userId: 'user-1',
      email: 'test@example.com',
    });
  });

  it('should throw UserNotFoundException if user does not exist', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('non-existent')).rejects.toThrow(UserNotFoundException);
    expect(userRepo.deactivate).not.toHaveBeenCalled();
    expect(tokenStore.revokeAll).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('should still deactivate user even if token revocation fails', async () => {
    userRepo.findById.mockResolvedValue(existingUser);
    tokenStore.revokeAll.mockRejectedValue(new Error('Redis down'));

    await expect(useCase.execute('user-1')).resolves.not.toThrow();
    expect(userRepo.deactivate).toHaveBeenCalledWith('user-1');
  });

  it('should still proceed if cache invalidation fails', async () => {
    userRepo.findById.mockResolvedValue(existingUser);
    cache.del.mockRejectedValue(new Error('Cache down'));

    await expect(useCase.execute('user-1')).resolves.not.toThrow();
    expect(userRepo.deactivate).toHaveBeenCalledWith('user-1');
    expect(eventEmitter.emit).toHaveBeenCalled();
  });
});
