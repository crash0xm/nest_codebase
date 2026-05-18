export type RedisConfig = {
  host: string;
  port: number;
  password?: string;
  db?: number;
  tls?: boolean;
  cluster?: boolean;
  connectTimeout?: number;
  lazyConnect?: boolean;
  maxRetriesPerRequest?: number;
};
