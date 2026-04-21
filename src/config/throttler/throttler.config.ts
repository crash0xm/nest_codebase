import { registerAs } from '@nestjs/config';
import { ThrottlerConfig, ThrottlerEndpointConfig } from './throttler-config.type';

export default registerAs<ThrottlerConfig>('throttler', () => {
  const defaultLimit = {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '10', 10),
  } as const;

  const authLimit = {
    ttl: 15 * 60 * 1000, // 15 minutes
    limit: 5, // 5 attempts max
  };

  const authEndpoints: ThrottlerEndpointConfig[] = [
    {
      pattern: /^\/auth\/login/,
      limit: authLimit,
    },
    {
      pattern: /^\/auth\/register/,
      limit: authLimit,
    },
    {
      pattern: /^\/auth\/refresh/,
      limit: {
        ttl: 5 * 60 * 1000, // 5 minutes
        limit: 10,
      },
    },
  ];

  const publicEndpoints: ThrottlerEndpointConfig[] = [
    {
      pattern: /^\/health/,
      limit: { ttl: 1000, limit: 1000 }, // Generous for health checks
    },
    {
      pattern: /^\/metrics/,
      limit: { ttl: 1000, limit: 1000 }, // Generous for metrics
    },
  ];

  const endpoints: ThrottlerEndpointConfig[] = [...authEndpoints, ...publicEndpoints];

  const whitelist = (process.env.THROTTLE_WHITELIST ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0);

  const storage = (process.env.THROTTLE_STORAGE ?? 'memory') as 'memory' | 'redis';

  return {
    default: defaultLimit,
    endpoints,
    storage,
    skipSuccessfulRequests: false,
    skipFailedRequests: process.env.THROTTLE_SKIP_FAILED === 'true',
    whitelist,
  };
});
