export type AuthConfig = {
  jwt: {
    accessToken: {
      secret: string;
      expiresIn: string;
    };
    refreshToken: {
      secret: string;
      expiresIn: string;
    };
    passwordReset: {
      secret: string;
      expiresIn: string;
    };
  };
  session: {
    maxActive: number;
    blacklistEnabled: boolean;
  };
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
};
