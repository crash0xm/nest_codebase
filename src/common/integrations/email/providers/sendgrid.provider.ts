import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService, type MailDataRequired } from '@sendgrid/mail';
import { BaseProvider } from '../../base.provider';
import type { EmailProvider, EmailMessage, EmailSendResult, EmailConfig } from '../email.interface';
import { EMAIL_CONFIG_KEY } from '../email.interface';

@Injectable()
export class SendgridProvider extends BaseProvider implements EmailProvider {
  private readonly mailService: MailService;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    super('SendGrid');

    const emailConfig = this.configService.get<EmailConfig>(EMAIL_CONFIG_KEY)!;
    if (!emailConfig?.sendgrid?.apiKey) {
      throw new Error('[SendgridProvider] SENDGRID_API_KEY is not configured');
    }

    this.mailService = new MailService();
    this.mailService.setApiKey(emailConfig.sendgrid.apiKey);
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      this.logOperation('send', { to: message.to, subject: message.subject });

      const emailConfig = this.configService.get<EmailConfig>(EMAIL_CONFIG_KEY)!;
      const content = [
        ...(message.html ? [{ type: 'text/html' as const, value: message.html }] : []),
        ...(message.text ? [{ type: 'text/plain' as const, value: message.text }] : []),
      ];

      if (content.length === 0) {
        throw new Error('Email must have either html or text content');
      }

      const msg = {
        to: Array.isArray(message.to) ? message.to : [message.to],
        cc: message.cc ? (Array.isArray(message.cc) ? message.cc : [message.cc]) : undefined,
        bcc: message.bcc ? (Array.isArray(message.bcc) ? message.bcc : [message.bcc]) : undefined,
        from:
          message.from ?? `${emailConfig.sendgrid!.fromName} <${emailConfig.sendgrid!.fromEmail}>`,
        subject: message.subject,
        content,
        attachments: message.attachments?.map((att) => ({
          filename: att.filename,
          content:
            att.content instanceof Buffer ? att.content.toString('base64') : String(att.content),
          type: att.contentType,
          disposition: 'attachment' as const,
        })),
      };

      const [response] = await this.mailService.send(msg as unknown as MailDataRequired);
      const responseRecord = response as unknown as Record<string, unknown>;
      const headers = responseRecord.headers as Record<string, unknown> | undefined;
      const messageId = headers?.['x-message-id'] as string | undefined;
      this.logOperation('send success', { messageId });

      return {
        success: true,
        messageId,
        providerResponse: { statusCode: responseRecord.statusCode as number | undefined },
      };
    } catch (error) {
      return this.createErrorResult(error, 'send') as EmailSendResult;
    }
  }

  async sendTemplate(message: EmailMessage): Promise<EmailSendResult> {
    try {
      this.logOperation('sendTemplate', {
        to: message.to,
        templateId: message.template?.templateId,
      });

      const emailConfig = this.configService.get<EmailConfig>(EMAIL_CONFIG_KEY)!;
      const msg = {
        to: Array.isArray(message.to) ? message.to : [message.to],
        from:
          message.from ?? `${emailConfig.sendgrid!.fromName} <${emailConfig.sendgrid!.fromEmail}>`,
        templateId: message.template!.templateId,
        dynamicTemplateData: message.template!.templateData,
      };

      const [response] = await this.mailService.send(msg as unknown as MailDataRequired);
      const responseRecord = response as unknown as Record<string, unknown>;
      const headers = responseRecord.headers as Record<string, unknown> | undefined;
      const messageId = headers?.['x-message-id'] as string | undefined;
      this.logOperation('sendTemplate success', { messageId });

      return {
        success: true,
        messageId,
        providerResponse: { statusCode: responseRecord.statusCode as number | undefined },
      };
    } catch (error) {
      return this.createErrorResult(error, 'sendTemplate') as EmailSendResult;
    }
  }

  getProviderName(): string {
    return 'SendGrid';
  }

  validateConfig(): Promise<boolean> {
    try {
      const emailConfig = this.configService.get<EmailConfig>(EMAIL_CONFIG_KEY);
      if (!emailConfig?.sendgrid?.apiKey) return Promise.resolve(false);
      return Promise.resolve(emailConfig.sendgrid.apiKey.startsWith('SG.'));
    } catch {
      return Promise.resolve(false);
    }
  }
}
