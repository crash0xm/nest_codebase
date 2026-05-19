import { Inject, Injectable } from '@nestjs/common';
import {
  IProductRepository,
  CreateProductDto,
} from '../../domain/repositories/product.repository.interface';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { ProductEntity } from '../../domain/entities/product.entity';
import { ConflictError } from '@/common/domain/errors/application.error';

@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(INJECTION_TOKENS.PRODUCT_REPOSITORY)
    private readonly productRepo: IProductRepository,
  ) {}

  async execute(dto: CreateProductDto): Promise<ProductEntity> {
    const exists = await this.productRepo.existsByName(dto.name);
    if (exists) {
      throw new ConflictError(`Product with name "${dto.name}" already exists`);
    }

    const product = ProductEntity.create(dto.name, dto.description, dto.price, dto.stock);

    return this.productRepo.create({
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
    });
  }
}
