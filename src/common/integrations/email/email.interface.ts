export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailTemplate {
  templateId: string;
  templateData: Record<string, unknown>;
}

export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: EmailTemplate;
  attachments?: EmailAttachment[];
  from?: string;
  replyTo?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  providerResponse?: Record<string, unknown>;
  error?: string;
}

export interface EmailProvider {
  /**
   * Send an email message
   */
  send(message: EmailMessage): Promise<EmailSendResult>;

  /**
   * Send email using template
   */
  sendTemplate(message: EmailMessage): Promise<EmailSendResult>;

  /**
   * Get provider name for logging/monitoring
   */
  getProviderName(): string;

  /**
   * Validate provider configuration
   */
  validateConfig(): Promise<boolean>;
}

export interface EmailConfig {
  provider: 'sendgrid' | 'ses' | 'mailgun';
  sendgrid?: {
    apiKey: string;
    fromEmail: string;
    fromName: string;
  };
  ses?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    fromEmail: string;
    fromName: string;
  };
  mailgun?: {
    domain: string;
    apiKey: string;
    fromEmail: string;
    fromName: string;
  };
}

export const EMAIL_CONFIG_KEY = 'email';
export const EMAIL_PROVIDER_TOKEN = 'EmailProvider';
