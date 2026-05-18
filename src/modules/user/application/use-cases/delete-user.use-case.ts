import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { CacheKeys } from '@/constants/cache.constant';
import { UserNotFoundException } from '@/common/domain/errors/application.error';
import type { ITokenStore } from '@/modules/auth/infrastructure/token-store/redis-token-store';

@Injectable()
export class DeleteUserUseCase {
  private readonly logger = new Logger(DeleteUserUseCase.name);

  constructor(
    @Inject(INJECTION_TOKENS.USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    // Add: inject token store
    @Inject(INJECTION_TOKENS.TOKEN_STORE)
    private readonly tokenStore: ITokenStore,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(id: string): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new UserNotFoundException(id);
    }

    // Soft delete
    await this.userRepo.deactivate(id);

    // Add: Revoke all sessions of user in Redis
    try {
      await this.tokenStore.revokeAll(id);
      this.logger.log(`[DeleteUser] Revoked all sessions: userId=${id}`);
    } catch (err) {
      // Log warning but don't block - user already soft deleted
      this.logger.error(`[DeleteUser] Failed to revoke sessions: userId=${id}`, err);
    }

    // Invalidate cache
    try {
      await Promise.all([
        this.cache.del(CacheKeys.user(id)),
        this.cache.del(CacheKeys.userByEmail(user.email)),
        this.cache.del(CacheKeys.userList(1, 20)),
      ]);
    } catch (err) {
      this.logger.warn('Cache invalidation failed', { id, err });
    }

    this.eventEmitter.emit('user.deleted', {
      userId: user.id,
      email: user.email,
    });
  }
}
