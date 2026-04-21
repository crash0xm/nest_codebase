import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpStatus,
  HttpCode,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateUserDto } from '../dtos/create-user.dto';
import { CreateUserDataDto } from '../../domain/repositories/user.repository.interface';
import { BaseResponse } from '@/common/interfaces/base-response.interface';
import { Role } from '@/modules/user/domain/enums/role.enum';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { GetUserByIdUseCase } from '../../application/use-cases/get-user-by-id.use-case';
import { GetUsersUseCase } from '../../application/use-cases/get-users.use-case';

import { Roles } from '@/common/guards/authorization.guard';
import type { UserProps } from '../../domain/entities/user.entity';

class UserResponse {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  fullName!: string;
  role!: Role;
  isActive!: boolean;
  isEmailVerified!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

interface UsersResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: Role;
}

interface PaginationParams {
  page?: number;
  limit?: number;
}

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly getUsersUseCase: GetUsersUseCase,
  ) {}

  private toResponse(
    user: Pick<
      UserProps,
      | 'id'
      | 'email'
      | 'firstName'
      | 'lastName'
      | 'role'
      | 'isActive'
      | 'isEmailVerified'
      | 'createdAt'
      | 'updatedAt'
    >,
  ): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Register a new user with email, name, and password',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
    type: UserResponse,
  })
  @ApiBody({
    type: CreateUserDto,
    description: 'User registration data',
    required: true,
  })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  @Roles(Role.ADMIN)
  async createUser(@Body() createUserDto: CreateUserDataDto): Promise<BaseResponse<UserResponse>> {
    const user = await this.createUserUseCase.execute(createUserDto);
    return {
      success: true,
      data: this.toResponse(user),
      message: 'User created successfully',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all users with pagination',
    description: 'Retrieve paginated list of users with optional filtering',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    example: 1,
    type: 'number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page',
    example: 10,
    type: 'number',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users retrieved successfully',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: '1',
            email: 'user1@example.com',
            firstName: 'John',
            lastName: 'Doe',
            fullName: 'John Doe',
            role: 'user',
          },
          {
            id: '2',
            email: 'user2@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
            fullName: 'Jane Smith',
            role: 'admin',
          },
        ],
        message: 'Users retrieved successfully',
        meta: {
          timestamp: '2024-01-01T00:00:00.000Z',
          requestId: 'req-123',
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
          },
        },
      },
    },
  })
  async getUsers(
    @Query() paginationParams: PaginationParams,
  ): Promise<BaseResponse<UsersResponse[]>> {
    const result = await this.getUsersUseCase.execute({
      page: paginationParams.page ?? 1,
      limit: paginationParams.limit ?? 10,
    });

    return {
      success: true,
      data: result.data.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        role: user.role,
      })),
      message: 'Users retrieved successfully',
      meta: {
        timestamp: new Date().toISOString(),
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      },
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve a specific user by their unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'User unique identifier',
    example: '550e8400-e29b-41d4-a616-42a8f4ab123',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User retrieved successfully',
    type: UserResponse,
    schema: {
      example: {
        success: true,
        data: {
          id: '550e8400-e29b-41d4-a616-42a8f4ab123',
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          role: 'user',
          isActive: true,
          isEmailVerified: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        message: 'User retrieved successfully',
        meta: {
          timestamp: '2024-01-01T00:00:00.000Z',
          requestId: 'req-123',
          traceId: 'trace-456',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async getUserById(@Param('id') id: string): Promise<BaseResponse<UserResponse>> {
    const user = await this.getUserByIdUseCase.execute(id);
    return {
      success: true,
      data: this.toResponse(user),
      message: 'User retrieved successfully',
    };
  }
}
