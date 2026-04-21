import { DomainEvent } from '@/common/domain/base.event';

export class UserCreatedEvent implements DomainEvent {
  readonly eventName = 'user.created';
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly createdAt: Date,
  ) {}
}
