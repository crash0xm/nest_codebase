export interface SendWelcomeEmailJob {
  userId: string;
  email: string;
  firstName: string;
}

export interface SendAccountUpdateEmailJob {
  userId: string;
  email: string;
  firstName: string;
  changes: Record<string, unknown>;
}
