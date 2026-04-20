import { Inject, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IUserRepository,
  UpdateUserDto,
} from '../../domain/repositories/user.repository.interface';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { CacheKeys } from '@/constants/cache.constant';
import { UserEntity } from '../../domain/entities/user.entity';

@Injectable()
export class UpdateUserUseCase {
  private readonly logger = new Logger(UpdateUserUseCase.name);

  constructor(
    @Inject(INJECTION_TOKENS.USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(id: string, data: UpdateUserDto): Promise<UserEntity> {
    const oldUser = await this.userRepo.findById(id);
    if (!oldUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const updated = await this.userRepo.update(id, data);

    // Clear cache with tag-based invalidation
    try {
      await Promise.all([
        this.cache.del(CacheKeys.user(id)),
        this.cache.del(CacheKeys.userByEmail(oldUser.email)),
        // Clear all user list cache with pattern matching
        this.cache.del('users:list:*'), // Tag-based: clear all user list pages
      ]);
    } catch (err) {
      this.logger.warn('Cache invalidation failed', { id, err });
      // Don't throw - continue
    }

    this.eventEmitter.emit('user.updated', {
      userId: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      changes: data,
    });

    return updated;
  }
}
