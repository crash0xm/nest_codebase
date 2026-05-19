import { UserEntity } from '../../domain/entities/user.entity';
import { Role } from '../../domain/enums/role.enum';
import {
  IUserRepository,
  PaginationOptions,
  PaginatedResult,
  CreateUserDto,
  UpdateUserDto,
} from '../../domain/repositories/user.repository.interface';
import { TypeOrmService } from '@/modules/typeorm/typeorm.service';
import { AppLoggerService } from '@/common/services/logger.service';
import { TypeOrmBaseRepository } from '@/common/repositories/typeorm-base.repository';
import { FindOptions } from '@/common/types/query.types';
import { UserOrmEntity } from '@/modules/user/infrastructure/orm/user-orm.entity';
import { SystemRole } from '@/modules/typeorm/entities/enums';
import {
  UserAlreadyExistsError,
  UserNotFoundException,
} from '@/common/domain/errors/application.error';
import { QueryFailedError, EntityNotFoundError, FindOptionsWhere } from 'typeorm';

export class TypeOrmUserRepository
  extends TypeOrmBaseRepository<UserOrmEntity, UserEntity>
  implements IUserRepository
{
  constructor(typeOrmService: TypeOrmService, logger: AppLoggerService) {
    super(typeOrmService, logger, 'User');
  }

  protected get entity(): new () => UserOrmEntity {
    return UserOrmEntity;
  }

  private mapRoleToDbRole(role: Role): SystemRole {
    switch (role) {
      case Role.USER:
        return SystemRole.user;
      case Role.ADMIN:
        return SystemRole.admin;
      default:
        return SystemRole.user;
    }
  }

  private mapToDomain(user: UserOrmEntity): UserEntity {
    return UserEntity.reconstitute({
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      role: user.systemRole as unknown as Role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      passwordHash: user.passwordHash ?? null,
    });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const repo = this.getRepository();
    const user = await repo.findOne({
      where: { email: email.toLowerCase() },
    });
    return user ? this.mapToDomain(user) : null;
  }

  async findById(id: string, options?: FindOptions): Promise<UserEntity | null> {
    const user = await super.findById(id, options);
    return user ? this.mapToDomain(user as unknown as UserOrmEntity) : null;
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<UserEntity>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const result = await super.findManyWithPagination({
      page,
      limit,
      filters: [{ field: 'isActive', operator: 'eq', value: true }],
      sort: [{ field: sortBy, order: sortOrder }],
    });

    return {
      data: result.data.map((user) => this.mapToDomain(user as unknown as UserOrmEntity)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async create(data: CreateUserDto): Promise<UserEntity> {
    const created = await super.create({
      email: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      systemRole: this.mapRoleToDbRole(data.role),
      passwordHash: data.passwordHash,
      isActive: true,
      locale: 'vi',
      timezone: 'Asia/Ho_Chi_Minh',
    });
    return this.mapToDomain(created as unknown as UserOrmEntity);
  }

  async update(id: string, data: Partial<UserOrmEntity> | UpdateUserDto): Promise<UserEntity> {
    const updateData: Partial<UserOrmEntity> = {};
    const updateDto = data as UpdateUserDto;
    if (updateDto.firstName != null) {
      updateData.firstName = updateDto.firstName;
    }
    if (updateDto.lastName != null) {
      updateData.lastName = updateDto.lastName;
    }
    if (updateDto.role != null) {
      updateData.systemRole = this.mapRoleToDbRole(updateDto.role);
    }

    const updated = await super.update(id, updateData);
    return this.mapToDomain(updated as unknown as UserOrmEntity);
  }

  async deactivate(id: string): Promise<void> {
    await super.update(id, { isActive: false });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const repo = this.getRepository();
    await repo.update({ id }, { passwordHash });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const repo = this.getRepository();
    const count = await repo.count({
      where: { email: email.toLowerCase() } as FindOptionsWhere<UserOrmEntity>,
    });
    return count > 0;
  }

  protected handleExecuteError(
    operation: string,
    error: unknown,
    metadata?: Record<string, unknown>,
  ): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string; constraint?: string };
      if (driverError?.code === '23505') {
        throw new UserAlreadyExistsError(
          (metadata?.data as { email?: string })?.email ?? 'unknown',
        );
      }
    }
    if (error instanceof EntityNotFoundError) {
      throw new UserNotFoundException((metadata?.id as string) ?? 'unknown');
    }
    super.handleExecuteError(operation, error, metadata);
  }
}
