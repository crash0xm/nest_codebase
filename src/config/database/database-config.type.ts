export type DatabaseConfig = {
  url: string;
  ssl?: boolean;
  acquireTimeout?: number;
  idleTimeout?: number;
  poolMin?: number;
  poolMax?: number;
  retryMax?: number;
  retryDelay?: number;
  retryBackoff?: number;
  slowQuery?: number;
};
