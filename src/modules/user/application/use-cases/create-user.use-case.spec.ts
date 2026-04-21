/* eslint-disable @typescript-eslint/unbound-method */
import { CreateUserUseCase } from './create-user.use-case';
import { ConflictError } from '@/common/domain/errors/application.error';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { createTestModule } from '@/common/utils/test-helpers';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CreateUserDataDto,
  IUserRepository,
} from '../../domain/repositories/user.repository.interface';
import { Role } from '../../domain/enums/role.enum';
import { PASSWORD_HASHER } from '@/common/services/password-hasher.service';

describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module = await createTestModule({
      providers: [
        CreateUserUseCase,
        {
          provide: INJECTION_TOKENS.USER_REPOSITORY,
          useValue: {
            existsByEmail: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: PASSWORD_HASHER,
          useValue: {
            hash: jest.fn().mockResolvedValue('hashed-password'),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    });

    useCase = module.get<CreateUserUseCase>(CreateUserUseCase);
    userRepository = module.get(INJECTION_TOKENS.USER_REPOSITORY);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should create a user successfully and emit UserCreatedEvent', async () => {
    // Arrange
    const dto: CreateUserDataDto = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      role: Role.USER,
    };
    userRepository.existsByEmail.mockResolvedValue(false);
    userRepository.create.mockResolvedValue({
      id: '1',
      _email: dto.email,
      _firstName: dto.firstName,
      _lastName: dto.lastName,
      _role: dto.role,
      _isActive: true,
      _isEmailVerified: false,
      _createdAt: new Date(),
      _updatedAt: new Date(),
      _deletedAt: null,
      _passwordHash: 'hashed-password',
    });

    // Act
    const result = await useCase.execute(dto);

    // Assert
    expect(result).toBeDefined();
    expect(result.email).toBe(dto.email);
    expect(userRepository.create as jest.Mock).toHaveBeenCalled();
    expect(eventEmitter.emit as jest.Mock).toHaveBeenCalledWith(
      'user.created',
      expect.objectContaining({
        email: dto.email,
        firstName: 'John',
      }),
    );
  });

  it('should throw ConflictException if email already exists', async () => {
    // Arrange
    const dto: CreateUserDataDto = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      role: Role.USER,
    };
    userRepository.existsByEmail.mockResolvedValue(true);

    // Act & Assert
    await expect(useCase.execute(dto)).rejects.toThrow(ConflictError);
    expect(userRepository.create as jest.Mock).not.toHaveBeenCalled();
    expect(eventEmitter.emit as jest.Mock).not.toHaveBeenCalled();
  });
});
