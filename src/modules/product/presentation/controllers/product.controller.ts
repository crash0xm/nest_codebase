import { Controller, Get, Post, Body, Param, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { CreateProductUseCase } from '../../application/use-cases/create-product.use-case';
import { ProductEntity } from '../../domain/entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { BaseResponse } from '@/common/interfaces/base-response.interface';
import { ok } from '@/common/utils/response.util';
import { ApplicationError } from '@/common/domain/errors/application.error';

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
  async create(
    @Body() createProductDto: CreateProductDto,
    @Req() req: FastifyRequest,
  ): Promise<BaseResponse<ProductEntity>> {
    const product = await this.createProductUseCase.execute(createProductDto);
    return ok(product, 'Product created successfully', req);
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
    throw new ApplicationError('This endpoint is not yet implemented', 'NOT_IMPLEMENTED', 501);
  }

  @Get()
  @ApiOperation({ summary: 'Get all products with pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products retrieved successfully',
  })
  findAll(): never {
    throw new ApplicationError('This endpoint is not yet implemented', 'NOT_IMPLEMENTED', 501);
  }
}
