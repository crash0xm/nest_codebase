import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductController } from './presentation/controllers/product.controller';
import { TypeOrmProductRepository } from './infrastructure/repositories/typeorm-product.repository';
import { ProductOrmEntity } from './infrastructure/orm/product-orm.entity';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { CreateProductUseCase } from './application/use-cases/create-product.use-case';

@Module({
  imports: [TypeOrmModule.forFeature([ProductOrmEntity])],
  controllers: [ProductController],
  providers: [
    {
      provide: INJECTION_TOKENS.PRODUCT_REPOSITORY,
      useClass: TypeOrmProductRepository,
    },

    // Use-cases
    CreateProductUseCase,
  ],
  exports: [INJECTION_TOKENS.PRODUCT_REPOSITORY],
})
export class ProductModule {}
