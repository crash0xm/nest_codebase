import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '@/common/domain/base.entity';

@Entity('refresh_tokens')
@Index(['userId'])
@Index(['tokenHash'])
export class RefreshTokenOrmEntity extends BaseEntity {
  constructor() {
    super();
  }

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'token_hash' })
  tokenHash!: string;

  @Column({ name: 'device_info', type: 'varchar', nullable: true })
  deviceInfo!: string | null;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', nullable: true, type: 'timestamptz' })
  revokedAt!: Date | null;
}
