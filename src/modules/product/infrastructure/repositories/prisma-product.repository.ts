import { Injectable } from '@nestjs/common';
import { ProductEntity } from '../../domain/entities/product.entity';
import {
  IProductRepository,
  PaginationOptions,
  PaginatedResult,
  CreateProductDto,
  UpdateProductDto,
} from '../../domain/repositories/product.repository.interface';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { PrismaBaseRepository } from '@/common/repositories/prisma-base.repository';
import { AppLoggerService } from '@/common/services/logger.service';

/** DB row shape for Product (mirrors Prisma model). */
interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type ProductModelDelegate = {
  findUnique(args: Record<string, unknown>): Promise<ProductRow | null>;
  findMany(args?: Record<string, unknown>): Promise<ProductRow[]>;
  count(args?: Record<string, unknown>): Promise<number>;
  create(args: Record<string, unknown>): Promise<ProductRow>;
  update(args: Record<string, unknown>): Promise<ProductRow>;
  delete(args: Record<string, unknown>): Promise<void>;
  findFirst(args?: Record<string, unknown>): Promise<ProductRow | null>;
};

@Injectable()
export class PrismaProductRepository
  extends PrismaBaseRepository<ProductRow>
  implements IProductRepository
{
  constructor(prisma: PrismaService, logger: AppLoggerService) {
    super(prisma, logger, 'Product');
  }

  protected getModelDelegate(): ProductModelDelegate {
    return (this.prisma as unknown as { product: ProductModelDelegate }).product;
  }

  private mapToDomain(product: ProductRow): ProductEntity {
    return ProductEntity.reconstitute({
      id: product.id,
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      stock: product.stock,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    });
  }

  async findById(id: string): Promise<ProductEntity | null> {
    const product = await super.findById(id);
    return product ? this.mapToDomain(product) : null;
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<ProductEntity>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const result = await super.findManyWithPagination({
      page,
      limit,
      sort: [{ field: sortBy, order: sortOrder }],
    });

    return {
      data: result.data.map((product) => this.mapToDomain(product)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async create(data: Record<string, unknown>): Promise<ProductEntity>;
  async create(data: CreateProductDto): Promise<ProductEntity>;
  async create(data: Record<string, unknown> | CreateProductDto): Promise<ProductEntity> {
    const product = await super.create(data as Partial<ProductRow>);
    return this.mapToDomain(product);
  }

  async update(id: string, data: Record<string, unknown>): Promise<ProductEntity>;
  async update(id: string, data: UpdateProductDto): Promise<ProductEntity>;
  async update(
    id: string,
    data: Record<string, unknown> | UpdateProductDto,
  ): Promise<ProductEntity> {
    const product = await super.update(id, data as Partial<ProductRow>);
    return this.mapToDomain(product);
  }

  async delete(id: string): Promise<void> {
    await super.delete(id);
  }

  async existsByName(name: string): Promise<boolean> {
    return super.exists({ filters: [{ field: 'name', operator: 'eq', value: name }] });
  }
}
