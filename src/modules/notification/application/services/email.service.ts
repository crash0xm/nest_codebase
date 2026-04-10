import { Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectMetric('email_sent_total')
    private readonly emailCounter: Counter,
  ) {}

  async send(to: string, subject: string, template: string): Promise<any> {
    this.logger.log(
      `[Email] Sending email to ${to}: ${subject} (template: ${template})`,
    );
    this.emailCounter.inc({ provider: 'simulated', status: 'success' });
    return { success: true, messageId: `msg-${Date.now()}` };
  }

  async sendWelcomeEmail(to: string): Promise<any> {
    this.logger.log(`[Email] Sending welcome email to ${to}`);
    this.emailCounter.inc({ provider: 'simulated', status: 'success' });
    return { success: true, messageId: `welcome-${Date.now()}` };
  }

  async sendAccountUpdateEmail(to: string): Promise<any> {
    this.logger.log(`[Email] Sending account update email to ${to}`);
    this.emailCounter.inc({ provider: 'simulated', status: 'success' });
    return { success: true, messageId: `update-${Date.now()}` };
  }

  async sendPasswordReset(to: string): Promise<any> {
    this.logger.log(`[Email] Sending password reset email to ${to}`);
    this.emailCounter.inc({ provider: 'simulated', status: 'success' });
    return { success: true, messageId: `reset-${Date.now()}` };
  }
}
