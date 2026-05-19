import { Entity, Column, Index } from 'typeorm';
import { SystemRole } from '@/modules/typeorm/entities/enums';
import { BaseOrmEntity } from '@/common/infrastructure/base-orm.entity';

@Entity('users')
@Index(['systemRole'])
@Index(['isActive'])
@Index(['createdAt'])
@Index(['deletedAt'])
export class UserOrmEntity extends BaseOrmEntity {
  constructor() {
    super();
  }

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'full_name', type: 'varchar', nullable: true })
  fullName!: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName!: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName!: string | null;

  @Column({ default: 'vi' })
  locale!: string;

  @Column({ default: 'Asia/Ho_Chi_Minh' })
  timezone!: string;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl!: string | null;

  @Column({
    name: 'system_role',
    type: 'enum',
    enum: SystemRole,
    default: SystemRole.user,
  })
  systemRole!: SystemRole;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'is_email_verified', default: false })
  isEmailVerified!: boolean;

  @Column({ name: 'last_login_at', nullable: true, type: 'timestamptz' })
  lastLoginAt!: Date | null;
}
