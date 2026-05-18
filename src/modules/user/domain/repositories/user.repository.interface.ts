import { UserEntity } from '../entities/user.entity';
import { Role } from '../enums/role.enum';

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findAll(options: PaginationOptions): Promise<PaginatedResult<UserEntity>>;
  create(data: CreateUserDto): Promise<UserEntity>;
  update(id: string, data: UpdateUserDto): Promise<UserEntity>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  delete(id: string): Promise<void>;
  existsByEmail(email: string): Promise<boolean>;
}

// DTOs cho repository methods
export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role: Role;
}

// DTO cho input từ controller (chưa hash)
export interface CreateUserDataDto {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: Role;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  role?: Role;
}
