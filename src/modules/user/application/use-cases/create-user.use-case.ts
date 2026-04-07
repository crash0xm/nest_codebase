import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IUserRepository,
  CreateUserDataDto,
} from '../../domain/repositories/user.repository.interface';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { UserEntity } from '../../domain/entities/user.entity';
import { ConflictError } from '@/common/domain/errors/application.error';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';

@Injectable()
export class CreateUserUseCase {
  private readonly logger = new Logger(CreateUserUseCase.name);

  constructor(
    @Inject(INJECTION_TOKENS.USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(dto: CreateUserDataDto): Promise<UserEntity> {
    const exists = await this.userRepo.existsByEmail(dto.email);
    if (exists) {
      throw new ConflictError(`User with email ${dto.email} already exists`);
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.userRepo.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordHash,
      role: dto.role,
    });

    // Emit event — listener sẽ push vào queue async
    this.eventEmitter.emit('user.created', {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      createdAt: user.createdAt,
    });

    return user;
  }
}
