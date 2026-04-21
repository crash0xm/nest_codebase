import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IUserRepository,
  CreateUserDataDto,
} from '../../domain/repositories/user.repository.interface';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { UserEntity } from '../../domain/entities/user.entity';
import { ConflictError } from '@/common/domain/errors/application.error';
import { IPasswordHasher, PASSWORD_HASHER } from '@/common/services/password-hasher.service';
import { UserCreatedEvent } from '../../domain/events/user-created.event';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(INJECTION_TOKENS.USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(dto: CreateUserDataDto): Promise<UserEntity> {
    const exists = await this.userRepo.existsByEmail(dto.email);
    if (exists) {
      throw new ConflictError(`User with email ${dto.email} already exists`);
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);

    const user = await this.userRepo.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordHash,
      role: dto.role,
    });

    this.eventEmitter.emit(
      'user.created',
      new UserCreatedEvent(user.id, user.email, user.firstName, user.createdAt),
    );

    return user;
  }
}
