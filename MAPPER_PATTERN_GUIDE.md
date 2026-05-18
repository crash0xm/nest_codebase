# Mapper Pattern — Hướng dẫn implement chuẩn Senior

---

## Folder Structure

```
src/modules/user/
  presentation/
    controllers/
      user.controller.ts
    dtos/
      create-user.dto.ts          ← input validation (giữ nguyên)
      update-user.dto.ts          ← input validation (giữ nguyên)
      user-response.dto.ts        ← THÊM MỚI: output shape
      user-query.dto.ts
    mappers/
      user.mapper.ts              ← THÊM MỚI: mapping logic
      user.mapper.spec.ts         ← THÊM MỚI: test mapper

src/modules/auth/
  presentation/
    dtos/
      auth-response.dto.ts        ← giữ nguyên
    mappers/
      auth.mapper.ts              ← THÊM MỚI
      auth.mapper.spec.ts         ← THÊM MỚI
```

---

## Bước 1 — Response DTOs

```typescript
// src/modules/user/presentation/dtos/user-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../domain/enums/role.enum';

export class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'John Doe' })
  fullName: string;

  @ApiProperty({ enum: Role, example: Role.USER })
  role: Role;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isEmailVerified: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  // passwordHash — KHÔNG CÓ Ở ĐÂY
  // Explicit by design, không phải magic decorator
}

// Dùng cho list response — chỉ expose fields cần thiết
export class UserSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'John Doe' })
  fullName: string;

  @ApiProperty({ enum: Role, example: Role.USER })
  role: Role;
}

// Dùng cho paginated list
export class UserPaginatedResponseDto {
  @ApiProperty({ type: [UserSummaryDto] })
  data: UserSummaryDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 10 })
  totalPages: number;
}
```

---

## Bước 2 — Mapper

```typescript
// src/modules/user/presentation/mappers/user.mapper.ts

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
   * GET /users/:id
   * POST /users
   * PATCH /users/:id
   */
  static toResponse(entity: UserEntity): UserResponseDto {
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
  static toSummary(entity: UserEntity): UserSummaryDto {
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
    result: PaginatedResult<UserEntity>,
  ): UserPaginatedResponseDto {
    return {
      data: result.data.map(UserMapper.toSummary),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }
}
```

---

## Bước 3 — Auth Mapper

```typescript
// src/modules/auth/presentation/mappers/auth.mapper.ts

import { UserEntity } from '../../../user/domain/entities/user.entity';
import { AuthUserPayload, TokenPair } from '../../application/services/auth.service';
import { AuthResponseDto } from '../dtos/auth-response.dto';

export class AuthMapper {
  static toAuthResponse(
    tokens: TokenPair,
    user: AuthUserPayload,
    expiresIn: number,
  ): AuthResponseDto {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  // Dùng cho GET /auth/me — full user info
  static toMeResponse(entity: UserEntity) {
    return {
      id: entity.id,
      email: entity.email,
      fullName: entity.fullName,
      role: entity.role,
      isActive: entity.isActive,
      isEmailVerified: entity.isEmailVerified,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
```

---

## Bước 4 — Controller dùng Mapper

```typescript
// src/modules/user/presentation/controllers/user.controller.ts

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly getUsersUseCase: GetUsersUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  async createUser(
    @Body() dto: CreateUserDto,
  ): Promise<BaseResponse<UserResponseDto>> {
    const user = await this.createUserUseCase.execute(dto);
    return {
      success: true,
      data: UserMapper.toResponse(user),
      message: 'User created successfully',
    };
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all users (paginated)' })
  @ApiResponse({ status: 200, type: UserPaginatedResponseDto })
  async getUsers(
    @Query() query: UserQueryDto,
  ): Promise<BaseResponse<UserPaginatedResponseDto>> {
    const result = await this.getUsersUseCase.execute(query);
    return {
      success: true,
      data: UserMapper.toPaginatedResponse(result),
      message: 'Users retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BaseResponse<UserResponseDto>> {
    const user = await this.getUserByIdUseCase.execute(id);
    return {
      success: true,
      data: UserMapper.toResponse(user),
      message: 'User retrieved successfully',
    };
  }
}
```

```typescript
// src/modules/auth/presentation/controllers/auth.controller.ts
// Chỉ cần thay các chỗ return thủ công → AuthMapper

@Post('login')
async login(@Req() req: LoginRequest): Promise<AuthResponseDto> {
  const tokens = await this.authService.login(req.user);
  const expiresIn = this.authService.getAccessTokenTtlSeconds();
  return AuthMapper.toAuthResponse(tokens, req.user, expiresIn);
}

@Post('register')
async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
  const { user, tokens } = await this.authService.register(
    dto.email,
    dto.password,
    dto.fullName,
  );
  const expiresIn = this.authService.getAccessTokenTtlSeconds();
  return AuthMapper.toAuthResponse(tokens, user, expiresIn);
}

@Get('me')
async getMe(@Req() req: LogoutRequest) {
  const user = await this.authService.getUserById(req.user.id);
  return AuthMapper.toMeResponse(user);
}
```

---

## Bước 5 — Tests cho Mapper

```typescript
// src/modules/user/presentation/mappers/user.mapper.spec.ts

import { UserMapper } from './user.mapper';
import { UserEntity } from '../../domain/entities/user.entity';
import { Role } from '../../domain/enums/role.enum';

const mockEntity = UserEntity.reconstitute({
  id: 'uuid-123',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: Role.USER,
  isActive: true,
  isEmailVerified: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
  passwordHash: 'super-secret-hash', // field nhạy cảm
});

describe('UserMapper', () => {
  describe('toResponse', () => {
    it('should map all required fields', () => {
      const dto = UserMapper.toResponse(mockEntity);

      expect(dto.id).toBe('uuid-123');
      expect(dto.email).toBe('john@example.com');
      expect(dto.firstName).toBe('John');
      expect(dto.lastName).toBe('Doe');
      expect(dto.fullName).toBe('John Doe');
      expect(dto.role).toBe(Role.USER);
      expect(dto.isActive).toBe(true);
      expect(dto.isEmailVerified).toBe(true);
    });

    it('should NOT expose passwordHash', () => {
      const dto = UserMapper.toResponse(mockEntity);
      expect(dto).not.toHaveProperty('passwordHash');
    });

    it('should NOT expose deletedAt', () => {
      const dto = UserMapper.toResponse(mockEntity);
      expect(dto).not.toHaveProperty('deletedAt');
    });
  });

  describe('toSummary', () => {
    it('should only expose summary fields', () => {
      const dto = UserMapper.toSummary(mockEntity);

      expect(Object.keys(dto)).toEqual(['id', 'email', 'fullName', 'role']);
    });

    it('should NOT expose sensitive or unnecessary fields', () => {
      const dto = UserMapper.toSummary(mockEntity);

      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('isActive');
      expect(dto).not.toHaveProperty('createdAt');
    });
  });

  describe('toPaginatedResponse', () => {
    it('should calculate totalPages correctly', () => {
      const result = UserMapper.toPaginatedResponse({
        data: [mockEntity, mockEntity],
        total: 25,
        page: 1,
        limit: 10,
      });

      expect(result.totalPages).toBe(3);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(25);
    });
  });
});
```

---

## Quy tắc khi thêm feature mới

### ✅ Đúng — luôn qua Mapper

```typescript
// use-case trả về domain entity
const user = await this.getUserByIdUseCase.execute(id);

// controller map qua Mapper trước khi return
return { success: true, data: UserMapper.toResponse(user) };
```

### ❌ Sai — return raw entity

```typescript
// KHÔNG BAO GIỜ return entity trực tiếp
const user = await this.getUserByIdUseCase.execute(id);
return { success: true, data: user }; // passwordHash có thể bị lộ
```

### ❌ Sai — map inline trong controller

```typescript
// KHÔNG làm thế này — duplicate, không reusable
return {
  success: true,
  data: {
    id: user.id,
    email: user.email,
    // ... copy paste
  },
};
```

---

## Checklist khi implement

- [ ] Tạo `user-response.dto.ts` với đầy đủ `@ApiProperty`
- [ ] Tạo `user.mapper.ts` với `toResponse`, `toSummary`, `toPaginatedResponse`
- [ ] Tạo `auth.mapper.ts` với `toAuthResponse`, `toMeResponse`
- [ ] Refactor `user.controller.ts` — xóa `toResponse()` private method, dùng `UserMapper`
- [ ] Refactor `auth.controller.ts` — dùng `AuthMapper`
- [ ] Viết `user.mapper.spec.ts` — test passwordHash không bị expose
- [ ] Viết `auth.mapper.spec.ts`
- [ ] Kiểm tra Swagger docs còn đúng sau refactor

---

## Nguyên tắc cốt lõi

> **Mapper là contract duy nhất** giữa domain và HTTP response.
> Domain entity có thể thay đổi thoải mái bên trong — chỉ cần Mapper đúng là API không bao giờ vỡ.
> Field nhạy cảm bị ẩn vì **không được thêm vào**, không phải vì magic decorator.
