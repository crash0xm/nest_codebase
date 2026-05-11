import { Injectable } from '@nestjs/common';
import { Prisma, SystemRole } from '@prisma/client';
import { UserEntity } from '../../domain/entities/user.entity';
import { Role } from '../../domain/enums/role.enum';
import {
  IUserRepository,
  PaginationOptions,
  PaginatedResult,
  CreateUserDto,
  UpdateUserDto,
} from '../../domain/repositories/user.repository.interface';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { AppLoggerService } from '@/common/services/logger.service';
import { PrismaBaseRepository } from '@/common/repositories/prisma-base.repository';
import { FindOptions } from '@/common/types/query.types';
import {
  UserAlreadyExistsError,
  UserNotFoundException,
} from '@/common/domain/errors/application.error';

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string | null;
  locale: string;
  timezone: string;
  avatarUrl: string | null;
  systemRole: SystemRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type UserModelDelegate = {
  findUnique(args: Record<string, unknown>): Promise<UserRow | null>;
  findMany(args?: Record<string, unknown>): Promise<UserRow[]>;
  count(args?: Record<string, unknown>): Promise<number>;
  create(args: Record<string, unknown>): Promise<UserRow>;
  update(args: Record<string, unknown>): Promise<UserRow>;
  delete(args: Record<string, unknown>): Promise<void>;
  findFirst(args?: Record<string, unknown>): Promise<UserRow | null>;
};

@Injectable()
export class PrismaUserRepository
  extends PrismaBaseRepository<UserRow, UserEntity>
  implements IUserRepository
{
  constructor(prisma: PrismaService, logger: AppLoggerService) {
    super(prisma, logger, 'User');
  }

  protected getModelDelegate(): UserModelDelegate {
    return (this.prisma as unknown as { user: UserModelDelegate }).user;
  }

  private mapRoleToPrismaRole(role: Role): SystemRole {
    switch (role) {
      case Role.USER:
        return SystemRole.user;
      case Role.ADMIN:
        return SystemRole.admin;
      default:
        return SystemRole.user;
    }
  }

  private mapToDomain(user: UserRow): UserEntity {
    const fullName = user.fullName ?? '';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ') ?? '';

    return UserEntity.reconstitute({
      id: user.id,
      email: user.email,
      firstName,
      lastName,
      role: user.systemRole as Role,
      isActive: user.isActive,
      isEmailVerified: true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: null,
      passwordHash: user.passwordHash ?? null,
    });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const delegate = this.getModelDelegate();
    const user = await delegate.findUnique({
      where: { email: email.toLowerCase() },
    });
    return user ? this.mapToDomain(user) : null;
  }

  async findById(id: string, options?: FindOptions): Promise<UserEntity | null> {
    const user = await super.findById(id, options);
    return user ? this.mapToDomain(user as unknown as UserRow) : null;
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
      data: result.data.map((user) => this.mapToDomain(user as unknown as UserRow)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async create(data: CreateUserDto): Promise<UserEntity> {
    const created = await super.create({
      email: data.email,
      fullName: `${data.firstName} ${data.lastName}`.trim(),
      systemRole: this.mapRoleToPrismaRole(data.role),
      passwordHash: data.passwordHash,
      isActive: true,
      locale: 'vi',
      timezone: 'Asia/Ho_Chi_Minh',
    } as unknown as Partial<UserRow>);
    return this.mapToDomain(created as unknown as UserRow);
  }

  async update(id: string, data: Partial<UserRow> | UpdateUserDto): Promise<UserEntity> {
    const updateData: Partial<UserRow> = {};
    const updateDto = data as UpdateUserDto;
    if (updateDto.firstName != null) {
      updateData.fullName = `${updateDto.firstName} ${updateDto.lastName ?? ''}`.trim();
    }
    if (updateDto.role != null) {
      updateData.systemRole = this.mapRoleToPrismaRole(updateDto.role);
    }

    const updated = await super.update(id, updateData);
    return this.mapToDomain(updated as unknown as UserRow);
  }

  async delete(id: string): Promise<void> {
    await super.update(id, { isActive: false } as unknown as Partial<UserRow>);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const delegate = this.getModelDelegate();
    const user = await delegate.findFirst({
      where: { email: email.toLowerCase() },
    });
    return !!user;
  }

  protected handleExecuteError(
    operation: string,
    error: unknown,
    metadata?: Record<string, unknown>,
  ): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new UserAlreadyExistsError(
          (metadata?.data as { email?: string })?.email ?? 'unknown',
        );
      }
      if (error.code === 'P2025') {
        throw new UserNotFoundException((metadata?.id as string) ?? 'unknown');
      }
    }
    super.handleExecuteError(operation, error, metadata);
  }
}
