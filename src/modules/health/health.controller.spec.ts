import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );
  });

  describe('liveness', () => {
    it('should return ok status with timestamp', () => {
      const result = controller.liveness();

      expect(result.status).toBe('ok');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should return current timestamp', () => {
      const before = Date.now();
      const result = controller.liveness();
      const after = Date.now();
      const timestampMs = new Date(result.timestamp).getTime();

      expect(timestampMs).toBeGreaterThanOrEqual(before);
      expect(timestampMs).toBeLessThanOrEqual(after);
    });
  });
});
