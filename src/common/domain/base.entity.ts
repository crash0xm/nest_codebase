/* eslint-disable @typescript-eslint/naming-convention */
import { plainToInstance } from 'class-transformer';

export abstract class BaseEntity<TId = string> {
  protected readonly _id: TId;
  protected readonly _createdAt: Date;
  protected _updatedAt: Date;
  protected readonly _deletedAt: Date | null;

  protected constructor(id: TId, createdAt?: Date, updatedAt?: Date, deletedAt?: Date | null) {
    this._id = id;
    this._createdAt = createdAt ?? new Date();
    this._updatedAt = updatedAt ?? new Date();
    this._deletedAt = deletedAt ?? null;
  }

  get id(): TId {
    return this._id;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get deletedAt(): Date | null {
    return this._deletedAt;
  }

  equals(other: BaseEntity<TId>): boolean {
    if (!(other instanceof BaseEntity)) return false;
    return this._id === other._id;
  }

  toDto<Dto>(dtoClass: new () => Dto): Dto {
    return plainToInstance(dtoClass, this);
  }

  protected touch(): void {
    this._updatedAt = new Date();
  }
}
