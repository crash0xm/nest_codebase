import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { USER_REPOSITORY, INJECTION_TOKENS } from '@/constants/injection-tokens';
import { InvalidCredentialsError } from '@/common/domain/errors/application.error';
import { createTestModule, PERFORMANCE_TOKENS } from '@/common/utils/test-helpers';
import { PASSWORD_HASHER } from '@/common/services/password-hasher.service';
import { Role } from '@/modules/user/domain/enums/role.enum';

// Mock uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: { findByEmail: jest.Mock; findById: jest.Mock };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock; decode: jest.Mock };
  let tokenStore: {
    save: jest.Mock;
    verify: jest.Mock;
    revoke: jest.Mock;
    revokeAll: jest.Mock;
    blacklistAccessToken: jest.Mock;
  };
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };
  let cls: { set: jest.Mock; get: jest.Mock };
  let passwordHasher: { verify: jest.Mock };

  beforeEach(async () => {
    userRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn(),
    };
    tokenStore = {
      save: jest.fn(),
      verify: jest.fn(),
      revoke: jest.fn(),
      revokeAll: jest.fn(),
      blacklistAccessToken: jest.fn(),
    };
    configService = {
      get: jest.fn(),
      getOrThrow: jest.fn().mockReturnValue({
        jwt: {
          accessToken: { secret: 'at-secret', expiresIn: '15m' },
          refreshToken: { secret: 'rt-secret', expiresIn: '7d' },
        },
      }),
    };
    cls = {
      set: jest.fn(),
      get: jest.fn().mockReturnValue('trace-id'),
    };
    passwordHasher = {
      verify: jest.fn(),
    };

    const module = await createTestModule({
      providers: [
        AuthService,
        { provide: USER_REPOSITORY, useValue: userRepo },
        { provide: PASSWORD_HASHER, useValue: passwordHasher },
        { provide: JwtService, useValue: jwtService },
        { provide: INJECTION_TOKENS.TOKEN_STORE, useValue: tokenStore },
        { provide: ConfigService, useValue: configService },
        { provide: ClsService, useValue: cls },
        {
          provide: PERFORMANCE_TOKENS.ACTIVE_SESSIONS_TOTAL,
          useValue: { dec: jest.fn(), inc: jest.fn() },
        },
      ],
    });

    service = module.get<AuthService>(AuthService);
  });

  describe('validateUser', () => {
    it('should throw InvalidCredentialsError if user not found', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      await expect(service.validateUser('test@example.com', 'pw')).rejects.toThrow(
        InvalidCredentialsError,
      );
    });

    it('should throw InvalidCredentialsError if password invalid', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'hash',
        isActive: true,
        isDeleted: false,
      };
      userRepo.findByEmail.mockResolvedValue(user);
      passwordHasher.verify.mockResolvedValue(false);
      await expect(service.validateUser('test@example.com', 'pw')).rejects.toThrow(
        InvalidCredentialsError,
      );
    });

    it('should return user payload if valid', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        role: 'user',
        passwordHash: 'hash',
        isActive: true,
        isDeleted: false,
      };
      userRepo.findByEmail.mockResolvedValue(user);
      passwordHasher.verify.mockResolvedValue(true);
      const result = await service.validateUser('test@example.com', 'pw');
      expect(result.id).toBe('1');
    });
  });

  describe('login', () => {
    it('should issue token pair and store refresh token', async () => {
      jwtService.signAsync.mockResolvedValue('token');
      const user = {
        id: '1',
        email: 'test@example.com',
        role: Role.USER,
        isActive: true,
      };

      const result = await service.login(user);

      expect(result.accessToken).toBeDefined();
      expect(tokenStore.save).toHaveBeenCalled();
    });
  });
});
