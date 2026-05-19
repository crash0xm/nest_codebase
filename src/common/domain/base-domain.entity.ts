export abstract class BaseDomainEntity {
  readonly id: string;
  readonly createdAt: Date;
  updatedAt: Date;
  readonly deletedAt: Date | null;

  protected constructor(
    id: string,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date(),
    deletedAt: Date | null = null,
  ) {
    this.id = id;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.deletedAt = deletedAt;
  }

  equals(other: BaseDomainEntity): boolean {
    return this.id === other.id;
  }

  protected touch(): void {
    this.updatedAt = new Date();
  }
}
