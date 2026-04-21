import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle:limit';
export const SKIP_THROTTLE_KEY = 'throttle:skip';

export interface ThrottleOption {
  limit: number;
  ttl: number; // milliseconds
}

export const Throttle = (option: ThrottleOption) => SetMetadata(THROTTLE_KEY, option);

export const SkipThrottle = () => SetMetadata(SKIP_THROTTLE_KEY, true);
