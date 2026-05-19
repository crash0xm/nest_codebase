import { InfrastructureError } from '@/common/domain/errors/infrastructure.error';

const DURATION_PATTERN = /^(\d+)([smhd])$/i;

const UNIT_TO_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

export function parseDurationToSeconds(duration: string): number {
  const normalized = duration.trim();
  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  const match = normalized.match(DURATION_PATTERN);
  if (!match) {
    throw new InfrastructureError(
      `Unsupported duration format: "${duration}"`,
      'INVALID_DURATION_FORMAT',
      { duration },
    );
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  return value * UNIT_TO_SECONDS[unit];
}
