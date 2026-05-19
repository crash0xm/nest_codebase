import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  HttpStatus,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UsePipes,
  ValidationPipe,
  Req,
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
import { FastifyRequest } from 'fastify';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UserResponseDto, UserPaginatedResponseDto } from '../dtos/user-response.dto';
import { CreateUserDataDto } from '../../domain/repositories/user.repository.interface';
import { Role } from '@/modules/user/domain/enums/role.enum';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { GetUserByIdUseCase } from '../../application/use-cases/get-user-by-id.use-case';
import { GetUsersUseCase } from '../../application/use-cases/get-users.use-case';
import { UpdateUserUseCase } from '../../application/use-cases/update-user.use-case';
import { DeleteUserUseCase } from '../../application/use-cases/delete-user.use-case';
import { UpdateUserDto } from '../../domain/repositories/user.repository.interface';
import { BaseResponse } from '@/common/interfaces/base-response.interface';
import { Roles } from '@/common/guards/authorization.guard';
import { UserMapper } from '../mappers/user.mapper';
import { PaginationParams } from '@/common/dtos/pagination.dto';
import { ok, paginated } from '@/common/utils/response.util';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly getUsersUseCase: GetUsersUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Register a new user with email, name, and password',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
    type: UserResponseDto,
    schema: {
      example: {
        success: true,
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          role: 'user',
          isActive: true,
          isEmailVerified: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        message: 'User created successfully',
      },
    },
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
  async createUser(
    @Body() createUserDto: CreateUserDataDto,
    @Req() req: FastifyRequest,
  ): Promise<BaseResponse<UserResponseDto>> {
    const user = await this.createUserUseCase.execute(createUserDto);
    return ok(UserMapper.toResponse(user), 'User created successfully', req);
  }

  @Get()
  @Roles(Role.ADMIN)
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
    type: UserPaginatedResponseDto,
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
    @Req() req: FastifyRequest,
  ): Promise<
    BaseResponse<{
      items: UserResponseDto[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>
  > {
    const result = await this.getUsersUseCase.execute({
      page: paginationParams.page ?? 1,
      limit: paginationParams.limit ?? 10,
    });
    return paginated(
      {
        data: result.data.map(UserMapper.toResponse),
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
      req,
    );
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
    type: UserResponseDto,
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
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: FastifyRequest,
  ): Promise<BaseResponse<UserResponseDto>> {
    const user = await this.getUserByIdUseCase.execute(id);
    return ok(UserMapper.toResponse(user), 'User retrieved successfully', req);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiParam({ name: 'id', description: 'User unique identifier', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: FastifyRequest,
  ): Promise<BaseResponse<UserResponseDto>> {
    const user = await this.updateUserUseCase.execute(id, updateUserDto);
    return ok(UserMapper.toResponse(user), 'User updated successfully', req);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user by ID' })
  @ApiParam({ name: 'id', description: 'User unique identifier', type: 'string' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'User deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async deleteUser(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.deleteUserUseCase.execute(id);
  }
}
