export interface DomainEvent {
  readonly eventName: string;
  readonly occurredAt: Date;
}

export abstract class BaseEvent<TId = string> implements DomainEvent {
  abstract readonly eventName: string;
  readonly id: TId;
  readonly occurredAt: Date;

  protected constructor(id: TId, occurredAt?: Date) {
    this.id = id;
    this.occurredAt = occurredAt ?? new Date();
  }
}
