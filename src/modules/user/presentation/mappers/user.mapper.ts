import { UserEntity } from '../../domain/entities/user.entity';
import {
  UserResponseDto,
  UserSummaryDto,
  UserPaginatedResponseDto,
} from '../dtos/user-response.dto';
import { PaginatedResult } from '@/common/types/pagination.types';

export class UserMapper {
  /**
   * Full response — dùng cho:
   * GET /users/:id, POST /users, PATCH /users/:id
   */
  static toResponse(this: void, entity: UserEntity): UserResponseDto {
    return {
      id: entity.id,
      email: entity.email,
      firstName: entity.firstName,
      lastName: entity.lastName,
      fullName: entity.fullName,
      role: entity.role,
      isActive: entity.isActive,
      isEmailVerified: entity.isEmailVerified,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * Minimal — dùng cho:
   * GET /users (list)
   * Embed trong response khác (author, assignee...)
   */
  static toSummary(this: void, entity: UserEntity): UserSummaryDto {
    return {
      id: entity.id,
      email: entity.email,
      fullName: entity.fullName,
      role: entity.role,
    };
  }

  /**
   * Paginated list — dùng cho:
   * GET /users?page=1&limit=10
   */
  static toPaginatedResponse(
    this: void,
    result: PaginatedResult<UserEntity>,
  ): UserPaginatedResponseDto {
    const totalPages = Math.ceil(result.total / result.limit);
    return {
      data: result.data.map(UserMapper.toSummary),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages,
      hasNext: result.page < totalPages,
      hasPrev: result.page > 1,
    };
  }
}
