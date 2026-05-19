import { Entity, Column } from 'typeorm';
import { BaseOrmEntity } from '@/common/infrastructure/base-orm.entity';

@Entity('products')
export class ProductOrmEntity extends BaseOrmEntity {
  constructor() {
    super();
  }

  @Column({ name: 'name' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column({ default: 0 })
  stock!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;
}
