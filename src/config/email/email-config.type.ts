export type EmailConfig = {
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
};
