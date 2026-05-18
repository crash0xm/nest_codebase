import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailProvider, EmailMessage, EmailSendResult, EmailConfig } from './email.interface';
import { EMAIL_CONFIG_KEY, EMAIL_PROVIDER_TOKEN } from './email.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(EMAIL_PROVIDER_TOKEN) private readonly provider: EmailProvider,
  ) {}

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    try {
      this.logger.log(`Sending email via ${this.provider.getProviderName()}`);
      const result = await this.provider.send(message);

      if (result.success) {
        this.logger.log(`Email sent successfully. MessageId: ${result.messageId}`);
      } else {
        this.logger.error(`Failed to send email: ${result.error}`);
      }
      return result;
    } catch (error) {
      this.logger.error('Unexpected error in EmailService.sendEmail', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendTemplateEmail(message: EmailMessage): Promise<EmailSendResult> {
    try {
      this.logger.log(`Sending template email via ${this.provider.getProviderName()}`);
      const result = await this.provider.sendTemplate(message);

      if (result.success) {
        this.logger.log(`Template email sent. MessageId: ${result.messageId}`);
      } else {
        this.logger.error(`Failed to send template email: ${result.error}`);
      }
      return result;
    } catch (error) {
      this.logger.error('Unexpected error in EmailService.sendTemplateEmail', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendWelcomeEmail(to: string, userName: string): Promise<EmailSendResult> {
    const emailConfig = this.configService.get<EmailConfig>(EMAIL_CONFIG_KEY)!;
    const fromName = emailConfig.sendgrid?.fromName ?? emailConfig.ses?.fromName ?? '';
    const fromEmail = emailConfig.sendgrid?.fromEmail ?? emailConfig.ses?.fromEmail ?? '';

    return this.sendEmail({
      to,
      subject: 'Welcome to our platform!',
      html: `<h1>Welcome, ${userName}!</h1><p>Thank you for joining our platform.</p>`,
      text: `Welcome, ${userName}!\n\nThank you for joining our platform.`,
      from: `${fromName} <${fromEmail}>`,
    });
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<EmailSendResult> {
    const emailConfig = this.configService.get<EmailConfig>(EMAIL_CONFIG_KEY)!;
    const fromName = emailConfig.sendgrid?.fromName ?? emailConfig.ses?.fromName ?? '';
    const fromEmail = emailConfig.sendgrid?.fromEmail ?? emailConfig.ses?.fromEmail ?? '';
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://example.com');
    const expiresIn = this.configService.get<string>('PASSWORD_RESET_EXPIRES_IN_HOURS', '1');

    return this.sendEmail({
      to,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <p><a href="${frontendUrl}/reset-password?token=${resetToken}">Reset Password</a></p>
        <p>This link expires in ${expiresIn} hour(s).</p>
      `,
      text: `Reset your password: ${frontendUrl}/reset-password?token=${resetToken}\n\nExpires in ${expiresIn} hour(s).`,
      from: `${fromName} <${fromEmail}>`,
    });
  }

  getProviderName(): string {
    return this.provider.getProviderName();
  }
}
