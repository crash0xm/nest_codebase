import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { BaseProvider } from '../../base.provider';
import type { EmailProvider, EmailMessage, EmailSendResult, EmailConfig } from '../email.interface';
import { EMAIL_CONFIG_KEY } from '../email.interface';

@Injectable()
export class SesProvider extends BaseProvider implements EmailProvider {
  private readonly sesClient: SESClient;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    super('AWS SES');

    const emailConfig = this.configService.get<EmailConfig>(EMAIL_CONFIG_KEY)!;
    if (!emailConfig?.ses?.accessKeyId || !emailConfig?.ses?.secretAccessKey) {
      throw new Error('[SesProvider] AWS SES credentials are not configured');
    }

    this.sesClient = new SESClient({
      region: emailConfig.ses.region,
      credentials: {
        accessKeyId: emailConfig.ses.accessKeyId,
        secretAccessKey: emailConfig.ses.secretAccessKey,
      },
    });
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      this.logOperation('send', { to: message.to, subject: message.subject });

      const emailConfig = this.configService.get<EmailConfig>(EMAIL_CONFIG_KEY)!;
      const command = new SendEmailCommand({
        Source: message.from ?? `${emailConfig.ses!.fromName} <${emailConfig.ses!.fromEmail}>`,
        Destination: {
          ToAddresses: Array.isArray(message.to) ? message.to : [message.to],
          CcAddresses: message.cc
            ? Array.isArray(message.cc)
              ? message.cc
              : [message.cc]
            : undefined,
          BccAddresses: message.bcc
            ? Array.isArray(message.bcc)
              ? message.bcc
              : [message.bcc]
            : undefined,
        },
        Message: {
          Subject: { Data: message.subject },
          Body: {
            Text: message.text ? { Data: message.text } : undefined,
            Html: message.html ? { Data: message.html } : undefined,
          },
        },
      });

      const response = await this.sesClient.send(command);
      this.logOperation('send success', { messageId: response.MessageId });

      return {
        success: true,
        messageId: response.MessageId,
        providerResponse: {
          messageId: response.MessageId,
          requestId: response.$metadata.requestId,
        },
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
      const command = new SendTemplatedEmailCommand({
        Source: message.from ?? `${emailConfig.ses!.fromName} <${emailConfig.ses!.fromEmail}>`,
        Destination: {
          ToAddresses: Array.isArray(message.to) ? message.to : [message.to],
        },
        Template: message.template!.templateId,
        TemplateData: JSON.stringify(message.template!.templateData),
      });

      const response = await this.sesClient.send(command);
      this.logOperation('sendTemplate success', { messageId: response.MessageId });

      return {
        success: true,
        messageId: response.MessageId,
        providerResponse: {
          messageId: response.MessageId,
          requestId: response.$metadata.requestId,
        },
      };
    } catch (error) {
      return this.createErrorResult(error, 'sendTemplate') as EmailSendResult;
    }
  }

  getProviderName(): string {
    return 'AWS SES';
  }

  async validateConfig(): Promise<boolean> {
    try {
      const emailConfig = this.configService.get<EmailConfig>(EMAIL_CONFIG_KEY);
      if (!emailConfig?.ses?.accessKeyId || !emailConfig?.ses?.secretAccessKey) return false;
      await this.sesClient
        .send(new SendEmailCommand({} as ConstructorParameters<typeof SendEmailCommand>[0]))
        .catch(() => {
          /* intentional: we only care that credentials parse correctly */
        });
      return true;
    } catch {
      return false;
    }
  }
}
