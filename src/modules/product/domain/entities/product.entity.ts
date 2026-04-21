import { v4 as uuidv4 } from 'uuid';
import { BaseEntity } from '@/common/domain/base.entity';

export class ProductEntity extends BaseEntity {
  private _name: string;
  private _description: string;
  private _price: number;
  private _stock: number;
  private _isActive: boolean;

  private constructor(data: ProductSnapshot) {
    super(data.id, data.createdAt, data.updatedAt);
    this._name = data.name;
    this._description = data.description;
    this._price = data.price;
    this._stock = data.stock;
    this._isActive = data.isActive ?? true;
  }

  static create(name: string, description: string, price: number, stock: number): ProductEntity {
    if (price <= 0) {
      throw new Error('Price must be greater than 0');
    }
    if (stock < 0) {
      throw new Error('Stock cannot be negative');
    }

    const now = new Date();

    return new ProductEntity({
      id: uuidv4(),
      name: name.trim(),
      description: description.trim(),
      price,
      stock,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(data: ProductSnapshot): ProductEntity {
    return new ProductEntity(data);
  }

  // Getters
  get name(): string {
    return this._name;
  }
  get description(): string {
    return this._description;
  }
  get price(): number {
    return this._price;
  }
  get stock(): number {
    return this._stock;
  }
  get isActive(): boolean {
    return this._isActive;
  }

  // Business methods
  updatePrice(newPrice: number): void {
    if (newPrice <= 0) {
      throw new Error('Price must be greater than 0');
    }
    this._price = newPrice;
    this.touch();
  }

  adjustStock(quantity: number): void {
    const newStock = this._stock + quantity;
    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }
    this._stock = newStock;
    this.touch();
  }

  activate(): void {
    this._isActive = true;
    this.touch();
  }

  deactivate(): void {
    this._isActive = false;
    this.touch();
  }

  toSnapshot(): ProductSnapshot {
    return {
      id: this._id,
      name: this._name,
      description: this._description,
      price: this._price,
      stock: this._stock,
      isActive: this._isActive,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

export interface ProductSnapshot {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
