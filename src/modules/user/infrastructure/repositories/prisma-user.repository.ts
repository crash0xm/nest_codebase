import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@/generated/prisma/client';
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
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private mapToDomain(user: User): UserEntity {
    const firstName = user.firstName ?? '';
    const lastName = user.lastName ?? '';

    return UserEntity.reconstitute({
      id: user.id,
      email: user.email,
      firstName,
      lastName,
      role: user.role as Role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      passwordHash: user.passwordHash || null,
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
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          passwordHash: data.passwordHash,
          isActive: true,
          isEmailVerified: false,
        },
      });
      return this.mapToDomain(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error as any).code === 'P2002'
      ) {
        throw new UserAlreadyExistsError(data.email);
      }
      throw new DatabaseError('create failed', error);
    }
  }

  async update(id: string, data: UpdateUserDto): Promise<UserEntity> {
    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: {
          ...(data.firstName != null && { firstName: data.firstName }),
          ...(data.lastName != null && { lastName: data.lastName }),
          ...(data.role != null && { role: data.role }),
          updatedAt: new Date(),
        },
      });
      return this.mapToDomain(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error as any).code === 'P2025'
      ) {
        throw new UserNotFoundException(id);
      }
      throw new DatabaseError('update failed', error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error as any).code === 'P2025'
      ) {
        throw new UserNotFoundException(id);
      }
      throw new DatabaseError('delete failed', error);
    }
  }

  async existsByEmail(email: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });
    return !!user;
  }
}
