import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EmailProvider, EmailMessage, EmailSendResult, EmailConfig } from './email.interface';
import { EMAIL_CONFIG_KEY } from './email.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: EmailProvider;

  constructor(
    @Inject('ConfigService') private readonly configService: ConfigService,
    @Inject('EmailProvider') provider: EmailProvider,
  ) {
    this.provider = provider;
  }

  /**
   * Send a simple email
   */
  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    try {
      this.logger.log(`Sending email via ${this.provider.getProviderName()}`);

      const result = await this.provider.send(message);

      if (result.success) {
        this.logger.log(`Email sent successfully. Message ID: ${result.messageId}`);
      } else {
        this.logger.error(`Failed to send email: ${result.error}`);
      }

      return result;
    } catch (error) {
      this.logger.error('Unexpected error in EmailService.sendEmail', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send email using template
   */
  async sendTemplateEmail(message: EmailMessage): Promise<EmailSendResult> {
    try {
      this.logger.log(`Sending template email via ${this.provider.getProviderName()}`);

      const result = await this.provider.sendTemplate(message);

      if (result.success) {
        this.logger.log(`Template email sent successfully. Message ID: ${result.messageId}`);
      } else {
        this.logger.error(`Failed to send template email: ${result.error}`);
      }

      return result;
    } catch (error) {
      this.logger.error('Unexpected error in EmailService.sendTemplateEmail', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to: string, userName: string): Promise<EmailSendResult> {
    const emailConfig = this.configService.get<EmailConfig>(EMAIL_CONFIG_KEY)!;

    return this.sendEmail({
      to,
      subject: 'Welcome to our platform!',
      html: `
        <h1>Welcome, ${userName}!</h1>
        <p>Thank you for joining our platform. We're excited to have you on board.</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <br>
        <p>Best regards,<br>The Team</p>
      `,
      text: `
        Welcome, ${userName}!
        
        Thank you for joining our platform. We're excited to have you on board.
        
        If you have any questions, please don't hesitate to contact us.
        
        Best regards,
        The Team
      `,
      from: `${emailConfig.sendgrid?.fromName ?? emailConfig.ses?.fromName} <${emailConfig.sendgrid?.fromEmail ?? emailConfig.ses?.fromEmail}>`,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, resetToken: string): Promise<EmailSendResult> {
    const emailConfig = this.configService.get<EmailConfig>(EMAIL_CONFIG_KEY)!;

    return this.sendEmail({
      to,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset Request</h1>
        <p>You requested to reset your password. Click the link below to reset it:</p>
        <p><a href="${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}">Reset Password</a></p>
        <p>This link will expire in ${this.configService.get('PASSWORD_RESET_EXPIRES_IN_HOURS', '1')} hour(s).</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
      text: `
        Password Reset Request
        
        You requested to reset your password. Copy and paste the link below to reset it:
        
        ${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}
        
        This link will expire in ${this.configService.get('PASSWORD_RESET_EXPIRES_IN_HOURS', '1')} hour(s).
        
        If you didn't request this, please ignore this email.
      `,
      from: `${emailConfig.sendgrid?.fromName ?? emailConfig.ses?.fromName} <${emailConfig.sendgrid?.fromEmail ?? emailConfig.ses?.fromEmail}>`,
    });
  }

  /**
   * Get current provider name
   */
  getProviderName(): string {
    return this.provider.getProviderName();
  }
}
