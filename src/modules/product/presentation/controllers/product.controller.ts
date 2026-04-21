import { Controller, Get, Post, Body, Param, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CreateProductUseCase } from '../../application/use-cases/create-product.use-case';
import { ProductEntity } from '../../domain/entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(private readonly createProductUseCase: CreateProductUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product created successfully',
    type: ProductEntity,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Product with this name already exists',
  })
  async create(@Body() createProductDto: CreateProductDto): Promise<ProductEntity> {
    return this.createProductUseCase.execute(createProductDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product found',
    type: ProductEntity,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found',
  })
  findById(@Param('id') _id: string): never {
    // TODO: Implement GetProductByIdUseCase
    throw new Error('Not implemented yet');
  }

  @Get()
  @ApiOperation({ summary: 'Get all products with pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products retrieved successfully',
  })
  findAll(): never {
    // TODO: Implement GetProductsUseCase
    throw new Error('Not implemented yet');
  }
}
