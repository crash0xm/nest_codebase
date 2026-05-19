import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductController } from './presentation/controllers/product.controller';
import { TypeOrmProductRepository } from './infrastructure/repositories/typeorm-product.repository';
import { ProductOrmEntity } from './infrastructure/orm/product-orm.entity';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { CreateProductUseCase } from './application/use-cases/create-product.use-case';
import { AppLoggerService } from '@common/services/logger.service';
import { ResourceOwnershipService } from '@/common/services/resource-ownership.service';
import { IProductRepository } from './domain/repositories/product.repository.interface';

@Module({
  imports: [TypeOrmModule.forFeature([ProductOrmEntity])],
  controllers: [ProductController],
  providers: [
    AppLoggerService,
    ResourceOwnershipService,
    {
      provide: INJECTION_TOKENS.PRODUCT_REPOSITORY,
      useClass: TypeOrmProductRepository,
    },
    CreateProductUseCase,
  ],
  exports: [INJECTION_TOKENS.PRODUCT_REPOSITORY],
})
export class ProductModule implements OnModuleInit {
  constructor(
    private readonly ownershipService: ResourceOwnershipService,
    @Inject(INJECTION_TOKENS.PRODUCT_REPOSITORY)
    private readonly productRepo: IProductRepository,
  ) {}

  onModuleInit(): void {
    this.ownershipService.registerHandler('product', (productId, userId) =>
      this.productRepo.isOwnedBy(productId, userId),
    );
  }
}
