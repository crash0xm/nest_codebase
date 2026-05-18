import { ProductEntity } from '../entities/product.entity';

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

export interface IProductRepository {
  findById(id: string): Promise<ProductEntity | null>;
  findAll(options: PaginationOptions): Promise<PaginatedResult<ProductEntity>>;
  create(data: CreateProductDto): Promise<ProductEntity>;
  update(id: string, data: UpdateProductDto): Promise<ProductEntity>;
  delete(id: string): Promise<void>;
  existsByName(name: string): Promise<boolean>;
  isOwnedBy(productId: string, userId: string): Promise<boolean>;
}

export interface CreateProductDto {
  name: string;
  description: string;
  price: number;
  stock: number;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  isActive?: boolean;
}
