import { DomainEvent } from '@/common/domain/base.event';

export class UserCreatedEvent implements DomainEvent {
  readonly eventName = 'user.created';
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly role: string,
    public readonly createdAt: Date,
  ) {}
}

export class UserUpdatedEvent implements DomainEvent {
  readonly eventName = 'user.updated';
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly changes: Record<string, unknown>,
  ) {}
}

export class UserDeletedEvent implements DomainEvent {
  readonly eventName = 'user.deleted';
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}
