import { plainToInstance } from 'class-transformer';
import { PrimaryGeneratedColumn, Column } from 'typeorm';

export abstract class BaseEntity<TId = string> {
  @PrimaryGeneratedColumn('uuid')
  id!: TId;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()', onUpdate: 'NOW()' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', nullable: true, type: 'timestamptz' })
  deletedAt!: Date | null;

  protected constructor(id?: TId, createdAt?: Date, updatedAt?: Date, deletedAt?: Date | null) {
    if (id !== undefined) {
      this.id = id;
      this.createdAt = createdAt ?? new Date();
      this.updatedAt = updatedAt ?? new Date();
      this.deletedAt = deletedAt ?? null;
    }
  }

  equals(other: BaseEntity<TId>): boolean {
    if (!(other instanceof BaseEntity)) return false;
    return this.id === other.id;
  }

  toDto<Dto>(dtoClass: new () => Dto): Dto {
    return plainToInstance(dtoClass, this);
  }

  protected touch(): void {
    this.updatedAt = new Date();
  }
}
