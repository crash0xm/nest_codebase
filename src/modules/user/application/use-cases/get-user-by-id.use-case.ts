import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { UserEntity } from '../../domain/entities/user.entity';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { CacheKeys } from '@/constants/cache.constant';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { NotFoundError } from '@/common/domain/errors/application.error';

@Injectable()
export class GetUserByIdUseCase {
  constructor(
    @Inject(INJECTION_TOKENS.USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectMetric('cache_hits_total')
    private readonly cacheHits: Counter,
    @InjectMetric('cache_misses_total')
    private readonly cacheMisses: Counter,
  ) {}

  async execute(id: string): Promise<UserEntity> {
    const key = CacheKeys.user(id);

    // Try to get from cache first
    const cached = await this.cache.get<UserEntity>(key);
    if (cached) {
      this.cacheHits.inc();
      return cached;
    }

    this.cacheMisses.inc();

    // Get from repository
    const user = await this.userRepo.findById(id);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    // Cache the result if found
    await this.cache.set(key, user, 300_000); // 5 minutes TTL

    return user;
  }
}
