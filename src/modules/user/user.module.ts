import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './presentation/controllers/user.controller';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { MetricsModule } from '@modules/metrics/metrics.module';
import { AuthModule } from '@modules/auth/auth.module';
import { AppLoggerService } from '@common/services/logger.service';
import { PasswordHasherService, PASSWORD_HASHER } from '@common/services/password-hasher.service';

// Import use-cases
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { GetUserByIdUseCase } from './application/use-cases/get-user-by-id.use-case';
import { GetUsersUseCase } from './application/use-cases/get-users.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';
import { DeleteUserUseCase } from './application/use-cases/delete-user.use-case';

@Module({
  imports: [MetricsModule, forwardRef(() => AuthModule)],
  controllers: [UserController],
  providers: [
    AppLoggerService,
    { provide: PASSWORD_HASHER, useClass: PasswordHasherService },
    // Repository binding - chỉ đổi 1 dòng này để swap DB
    {
      provide: INJECTION_TOKENS.USER_REPOSITORY,
      useClass: PrismaUserRepository, // ← ĐỔI DUY NHẤT DÒNG NÀY ĐỂ SWAP DB
    },

    // Use-cases
    CreateUserUseCase,
    GetUserByIdUseCase,
    GetUsersUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
  ],
  exports: [INJECTION_TOKENS.USER_REPOSITORY],
})
export class UserModule {}
