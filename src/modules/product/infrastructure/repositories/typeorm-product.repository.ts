import { Injectable } from '@nestjs/common';
import { ProductEntity } from '../../domain/entities/product.entity';
import {
  IProductRepository,
  PaginationOptions,
  PaginatedResult,
  CreateProductDto,
  UpdateProductDto,
} from '../../domain/repositories/product.repository.interface';
import { TypeOrmService } from '@/modules/typeorm/typeorm.service';
import { TypeOrmBaseRepository } from '@/common/repositories/typeorm-base.repository';
import { AppLoggerService } from '@/common/services/logger.service';
import { ProductOrmEntity } from '@/modules/product/infrastructure/orm/product-orm.entity';
import { FindOptionsWhere } from 'typeorm';

@Injectable()
export class TypeOrmProductRepository
  extends TypeOrmBaseRepository<ProductOrmEntity, ProductEntity>
  implements IProductRepository
{
  constructor(typeOrmService: TypeOrmService, logger: AppLoggerService) {
    super(typeOrmService, logger, 'Product');
  }

  protected get entity(): new () => ProductOrmEntity {
    return ProductOrmEntity;
  }

  private mapToDomain(product: ProductOrmEntity): ProductEntity {
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
    return product ? this.mapToDomain(product as unknown as ProductOrmEntity) : null;
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<ProductEntity>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const result = await super.findManyWithPagination({
      page,
      limit,
      sort: [{ field: sortBy, order: sortOrder }],
    });

    return {
      data: result.data.map((product) => this.mapToDomain(product as unknown as ProductOrmEntity)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async create(data: Record<string, unknown>): Promise<ProductEntity>;
  async create(data: CreateProductDto): Promise<ProductEntity>;
  async create(data: Record<string, unknown> | CreateProductDto): Promise<ProductEntity> {
    const product = await super.create(data as Partial<ProductOrmEntity>);
    return this.mapToDomain(product as unknown as ProductOrmEntity);
  }

  async update(id: string, data: Record<string, unknown>): Promise<ProductEntity>;
  async update(id: string, data: UpdateProductDto): Promise<ProductEntity>;
  async update(
    id: string,
    data: Record<string, unknown> | UpdateProductDto,
  ): Promise<ProductEntity> {
    const product = await super.update(id, data as Partial<ProductOrmEntity>);
    return this.mapToDomain(product as unknown as ProductOrmEntity);
  }

  async delete(id: string): Promise<void> {
    await super.delete(id);
  }

  async existsByName(name: string): Promise<boolean> {
    return super.exists({ filters: [{ field: 'name', operator: 'eq', value: name }] });
  }

  async isOwnedBy(productId: string, userId: string): Promise<boolean> {
    const repo = this.typeOrmService.getRepository(ProductOrmEntity);
    const count = await repo.count({
      where: { id: productId, userId } as FindOptionsWhere<ProductOrmEntity>,
    });
    return count > 0;
  }
}
