import { BaseEntity } from '@/common/domain/base.entity';

import { Role } from '../enums/role.enum';
import { Email } from '../value-objects/email.value-object';
import { InvalidNameError, UserAlreadyDeactivatedError } from '@/common/domain/errors/domain.error';

// ── No Prisma imports here — domain is pure ──────────────────────────────────

export interface UserProps {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  passwordHash?: string | null;
}

export class UserEntity extends BaseEntity {
  private _email: Email;
  private _firstName: string;
  private _lastName: string;
  private _role: Role;
  private _isActive: boolean;
  readonly isEmailVerified: boolean;
  protected _deletedAt: Date | null;
  private _passwordHash?: string | null;

  private constructor(props: UserProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this._email = Email.create(props.email);
    this._firstName = props.firstName;
    this._lastName = props.lastName;
    this._role = props.role;
    this._isActive = props.isActive;
    this.isEmailVerified = props.isEmailVerified;
    this._deletedAt = props.deletedAt ?? null;
    this._passwordHash = props.passwordHash;
  }

  static reconstitute(props: UserProps): UserEntity {
    return new UserEntity(props);
  }

  get email(): string {
    return this._email.value;
  }
  get firstName(): string {
    return this._firstName;
  }
  get lastName(): string {
    return this._lastName;
  }
  get fullName(): string {
    return `${this._firstName} ${this._lastName}`;
  }
  get role(): Role {
    return this._role;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get deletedAt(): Date | null {
    return this._deletedAt;
  }

  get isDeleted(): boolean {
    return !!this.deletedAt;
  }

  deactivate(): void {
    if (!this._isActive) {
      throw new UserAlreadyDeactivatedError(this._id);
    }
    this._isActive = false;
    this.touch();
  }

  activate(): void {
    this._isActive = true;
    this.touch();
  }

  updateProfile(firstName: string, lastName: string): void {
    if (!firstName.trim()) throw new InvalidNameError('firstName');
    if (!lastName.trim()) throw new InvalidNameError('lastName');
    this._firstName = firstName.trim();
    this._lastName = lastName.trim();
    this.touch();
  }

  assignRole(role: Role): void {
    this._role = role;
    this.touch();
  }

  get passwordHash(): string | null | undefined {
    return this._passwordHash;
  }

  setPasswordHash(hash: string): void {
    this._passwordHash = hash;
    this.touch();
  }

  toSnapshot(): UserProps {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      isActive: this.isActive,
      isEmailVerified: this.isEmailVerified,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
      passwordHash: this._passwordHash,
    };
  }
}
