import { Injectable, Inject } from '@nestjs/common';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import {
  IUserRepository,
  PaginationOptions,
  PaginatedResult,
} from '../../domain/repositories/user.repository.interface';
import { UserEntity } from '../../domain/entities/user.entity';

@Injectable()
export class GetUsersUseCase {
  constructor(
    @Inject(INJECTION_TOKENS.USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(options: PaginationOptions): Promise<PaginatedResult<UserEntity>> {
    return this.userRepository.findAll(options);
  }
}
