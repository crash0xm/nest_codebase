import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './presentation/controllers/user.controller';
import { TypeOrmUserRepository } from './infrastructure/repositories/typeorm-user.repository';
import { UserOrmEntity } from './infrastructure/orm/user-orm.entity';
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
  imports: [TypeOrmModule.forFeature([UserOrmEntity]), MetricsModule, forwardRef(() => AuthModule)],
  controllers: [UserController],
  providers: [
    AppLoggerService,
    { provide: PASSWORD_HASHER, useClass: PasswordHasherService },
    // Repository binding
    {
      provide: INJECTION_TOKENS.USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
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
