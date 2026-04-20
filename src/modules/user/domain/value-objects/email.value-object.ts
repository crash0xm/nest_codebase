import { BaseValueObject } from '@/common/domain/base.value-object';
import { InvalidEmailError } from '@/common/domain/errors/domain.error';

type EmailProps = {
  value: string;
};

export class Email extends BaseValueObject<EmailProps> {
  private static readonly EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  private constructor(props: EmailProps) {
    super(props);
    this.validate(props);
  }

  static create(email: string): Email {
    return new Email({ value: email.toLowerCase().trim() });
  }

  protected validate(props: EmailProps): void {
    if (!props.value || !Email.EMAIL_REGEX.test(props.value)) {
      throw new InvalidEmailError(props.value);
    }
    if (props.value.length > 255) {
      throw new InvalidEmailError(props.value);
    }
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
