import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectMetric('email_sent_total')
    private readonly emailCounter: Counter,
    @Inject('TEMPLATE_SERVICE') // Template service injected
    private readonly templateService: any,
  ) {}

  async send(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.templateService.render(template, context);
      // Simulate email sending - in real app, use actual email service
      this.emailCounter.inc({ provider: 'simulated', status: 'success' });
      this.logger.log(`Email sent to ${to} with subject: ${subject}`);
    } catch (error) {
      this.emailCounter.inc({ provider: 'simulated', status: 'error' });
      this.logger.error('Failed to send email', { error, to, subject, template });
      throw error;
    }
  }

  async sendWelcomeEmail(userEmail: string, userName: string): Promise<void> {
    this.send(userEmail, 'Welcome to our platform!', 'welcome', { userName, userEmail });
  }

  async sendAccountUpdateEmail(
    userEmail: string,
    userName: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
    this.send(userEmail, 'Account updated', 'account-update', { userName, userEmail, changes });
  }

  async sendPasswordReset(userEmail: string, resetToken: string): Promise<void> {
    this.send(userEmail, 'Password reset request', 'password-reset', { userEmail, resetToken });
  }
}
