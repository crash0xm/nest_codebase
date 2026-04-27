import { Injectable } from '@nestjs/common';
import { Prisma, User, SystemRole } from '@/generated/prisma/client';
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
import { DatabaseError } from '@/common/errors/infrastructure.error';
import {
  UserAlreadyExistsError,
  UserNotFoundException,
} from '@/common/domain/errors/application.error';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private isPrismaKnownError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError;
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

  private mapToDomain(user: User): UserEntity {
    const fullName = user.fullName ?? '';
    // Split fullName into firstName and lastName for backward compatibility
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
      isEmailVerified: true, // Default to true since schema doesn't have this field
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: null, // Schema doesn't have deletedAt field
      passwordHash: user.passwordHash ?? null,
    });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return user ? this.mapToDomain(user) : null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    return user ? this.mapToDomain(user) : null;
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<UserEntity>> {
    const where = { deletedAt: null, isActive: true };
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => this.mapToDomain(user)),
      total,
      page,
      limit,
    };
  }

  async create(data: CreateUserDto): Promise<UserEntity> {
    try {
      const created = await this.prisma.user.create({
        data: {
          email: data.email,
          fullName: `${data.firstName} ${data.lastName}`.trim(),
          systemRole: this.mapRoleToPrismaRole(data.role),
          passwordHash: data.passwordHash,
          isActive: true,
        },
      });
      return this.mapToDomain(created);
    } catch (error: unknown) {
      if (this.isPrismaKnownError(error)) {
        const prismaError = error as { code: string };
        const errorCode = prismaError.code;
        if (errorCode === 'P2002') {
          throw new UserAlreadyExistsError(data.email);
        }
        throw new DatabaseError('create failed', error);
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateUserDto): Promise<UserEntity> {
    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: {
          ...(data.firstName != null && {
            fullName: `${data.firstName} ${data.lastName ?? ''}`.trim(),
          }),
          ...(data.role != null && { systemRole: this.mapRoleToPrismaRole(data.role) }),
          updatedAt: new Date(),
        },
      });
      return this.mapToDomain(updated);
    } catch (error: unknown) {
      if (this.isPrismaKnownError(error)) {
        const prismaError = error as { code: string };
        const errorCode = prismaError.code;
        if (errorCode === 'P2025') {
          throw new UserNotFoundException(id);
        }
        throw new DatabaseError('update failed', error);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error: unknown) {
      if (this.isPrismaKnownError(error)) {
        const prismaError = error as { code: string };
        const errorCode = prismaError.code;
        if (errorCode === 'P2025') {
          throw new UserNotFoundException(id);
        }
        throw new DatabaseError('delete failed', error);
      }
      throw error;
    }
  }

  async existsByEmail(email: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });
    return !!user;
  }
}
