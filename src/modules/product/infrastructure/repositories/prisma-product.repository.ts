import { Injectable } from '@nestjs/common';
import { Product } from '@/generated/prisma/client';
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

@Injectable()
export class PrismaProductRepository
  extends PrismaBaseRepository<ProductEntity>
  implements IProductRepository
{
  constructor(prisma: PrismaService, logger: AppLoggerService) {
    super(prisma, logger, 'Product');
  }

  protected getModelDelegate() {
    return (this.prisma as any).product;
  }

  private mapToDomain(product: Product): ProductEntity {
    return ProductEntity.reconstitute({
      id: product.id,
      name: product.name,
      description: product.description ?? undefined,
      price: product.price,
      stock: product.stock,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    });
  }

  async findById(id: string): Promise<ProductEntity | null> {
    const product = await super.findById(id);
    return product ? this.mapToDomain(product as unknown as Product) : null;
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<ProductEntity>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const result = await super.findManyWithPagination(undefined, {
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return {
      data: result.data.map((product) =>
        this.mapToDomain(product as unknown as Product),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async create(data: Record<string, unknown>): Promise<ProductEntity>;
  async create(data: CreateProductDto): Promise<ProductEntity>;
  async create(
    data: Record<string, unknown> | CreateProductDto,
  ): Promise<ProductEntity> {
    const product = await super.create(data as Record<string, unknown>);
    return this.mapToDomain(product as unknown as Product);
  }

  async update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ProductEntity>;
  async update(id: string, data: UpdateProductDto): Promise<ProductEntity>;
  async update(
    id: string,
    data: Record<string, unknown> | UpdateProductDto,
  ): Promise<ProductEntity> {
    const product = await super.update(id, data as Record<string, unknown>);
    return this.mapToDomain(product as unknown as Product);
  }

  async delete(id: string): Promise<void> {
    await super.delete(id);
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return super.count(where);
  }

  async exists(where: Record<string, unknown>): Promise<boolean> {
    return super.exists(where);
  }

  async existsByName(name: string): Promise<boolean> {
    return super.exists({ name });
  }
}
