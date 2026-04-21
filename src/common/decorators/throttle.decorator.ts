import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle:limit';
export const SKIP_THROTTLE_KEY = 'throttle:skip';

export interface ThrottleOption {
  limit: number;
  ttl: number; // milliseconds
}

/**
 * 自定义端点的速率限制
 * @example
 * @Throttle({ limit: 10, ttl: 60000 })
 * findAll() { }
 */
export const Throttle = (option: ThrottleOption): void => SetMetadata(THROTTLE_KEY, option);

/**
 * 跳过速率限制检查的端点
 * @example
 * @SkipThrottle()
 * health() { }
 */
export const SkipThrottle = (): void => SetMetadata(SKIP_THROTTLE_KEY, true);
