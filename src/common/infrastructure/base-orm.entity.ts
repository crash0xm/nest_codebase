import {
  PrimaryGeneratedColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';

export abstract class BaseOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  protected constructor(id?: string, createdAt?: Date, updatedAt?: Date, deletedAt?: Date | null) {
    if (id !== undefined) {
      this.id = id;
      this.createdAt = createdAt ?? new Date();
      this.updatedAt = updatedAt ?? new Date();
      this.deletedAt = deletedAt ?? null;
    }
  }

  equals(other: BaseOrmEntity): boolean {
    if (!(other instanceof BaseOrmEntity)) return false;
    return this.id === other.id;
  }

  protected touch(): void {
    this.updatedAt = new Date();
  }
}
