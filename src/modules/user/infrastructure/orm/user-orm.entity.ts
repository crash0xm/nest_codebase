import { Entity, Column, Index } from 'typeorm';
import { SystemRole } from '@/modules/typeorm/entities/enums';
import { BaseEntity } from '@/common/domain/base.entity';

@Entity('users')
@Index(['systemRole'])
@Index(['isActive'])
@Index(['createdAt'])
export class UserOrmEntity extends BaseEntity {
  constructor() {
    super();
  }

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'full_name', type: 'varchar', nullable: true })
  fullName!: string | null;

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
