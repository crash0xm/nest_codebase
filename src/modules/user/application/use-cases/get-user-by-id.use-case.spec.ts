import { GetUserByIdUseCase } from './get-user-by-id.use-case';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { USER_REPOSITORY } from '@/constants/injection-tokens';
import { CacheKeys } from '@/constants/cache.constant';
import { createTestModule } from '@/common/utils/test-helpers';

describe('GetUserByIdUseCase', () => {
  let useCase: GetUserByIdUseCase;
  let repo: Record<string, jest.Mock>;
  let cache: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
    };
    cache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module = await createTestModule({
      providers: [
        GetUserByIdUseCase,
        { provide: USER_REPOSITORY, useValue: repo },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    });

    useCase = module.get<GetUserByIdUseCase>(GetUserByIdUseCase);
  });

  it('should return cached user if exists', async () => {
    const user = { id: '1', email: 'test@example.com' };
    cache.get.mockResolvedValue(user);

    const result = await useCase.execute('1');

    expect(result).toEqual(user);
    expect(cache.get).toHaveBeenCalledWith(CacheKeys.user('1'));
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('should fetch from repo and cache if not in cache', async () => {
    const user = { id: '1', email: 'test@example.com' };
    cache.get.mockResolvedValue(null);
    repo.findById.mockResolvedValue(user);

    const result = await useCase.execute('1');

    expect(result).toEqual(user);
    expect(repo.findById).toHaveBeenCalledWith('1');
    expect(cache.set).toHaveBeenCalledWith(CacheKeys.user('1'), user, 300_000);
  });

  it('should throw NotFoundException if user not found in repo', async () => {
    cache.get.mockResolvedValue(null);
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('1')).rejects.toThrow(NotFoundException);
  });
});
