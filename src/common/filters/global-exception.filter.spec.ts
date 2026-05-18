import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ApplicationError, NotFoundError } from '@/common/domain/errors/application.error';
import { InvalidEmailError } from '@/common/domain/errors/domain.error';
import { DatabaseError } from '@/common/domain/errors/infrastructure.error';

interface MockResponse {
  code: jest.Mock<MockResponse, [number]>;
  send: jest.Mock<unknown, [Record<string, unknown>]>;
}

function getLastSendPayload(res: MockResponse): Record<string, unknown> | undefined {
  return res.send.mock.calls[0]?.[0];
}

function mockArgumentsHost(
  url = '/test',
  method = 'GET',
): {
  switchToHttp: () => {
    getResponse: () => MockResponse;
    getRequest: () => Record<string, unknown>;
  };
} {
  const response: MockResponse = {
    code: jest.fn().mockReturnThis() as MockResponse['code'],
    send: jest.fn() as MockResponse['send'],
  };
  const request = {
    url,
    method,
    headers: { 'x-request-id': 'req-123', 'x-trace-id': 'trace-456' },
  };
  return { switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }) };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = { get: jest.fn().mockReturnValue('development') };
    filter = new GlobalExceptionFilter(configService as unknown as ConfigService);
  });

  describe('ApplicationError', () => {
    it('should return 404 with NOT_FOUND code', () => {
      const host = mockArgumentsHost();
      const error = new NotFoundError('User', '1');

      filter.catch(error, host as never);

      const res = host.switchToHttp().getResponse();
      expect(res.code).toHaveBeenCalledWith(404);
      const payload = getLastSendPayload(res);
      expect(payload?.success).toBe(false);
      expect((payload?.error as Record<string, unknown>).code).toBe('NOT_FOUND');
    });

    it('should include context when present', () => {
      const host = mockArgumentsHost();
      const error = new ApplicationError('Custom', 'CUSTOM_ERROR', 400, { key: 'value' });

      filter.catch(error, host as never);

      const payload = getLastSendPayload(host.switchToHttp().getResponse());
      expect((payload?.error as Record<string, unknown>).context).toEqual({ key: 'value' });
    });
  });

  describe('DomainError', () => {
    it('should return 422 for domain errors', () => {
      const host = mockArgumentsHost();
      const error = InvalidEmailError.create('test');

      filter.catch(error, host as never);

      const payload = getLastSendPayload(host.switchToHttp().getResponse());
      expect((payload?.meta as Record<string, unknown>).statusCode).toBe(422);
      expect(payload?.success).toBe(false);
    });
  });

  describe('InfrastructureError', () => {
    it('should return 503 with generic message', () => {
      const host = mockArgumentsHost();
      const error = new DatabaseError('findAll');

      filter.catch(error, host as never);

      const payload = getLastSendPayload(host.switchToHttp().getResponse());
      expect((payload?.meta as Record<string, unknown>).statusCode).toBe(503);
      expect((payload?.error as Record<string, unknown>).message).toBe(
        'Service temporarily unavailable',
      );
      expect(payload?.success).toBe(false);
    });
  });

  describe('HttpException', () => {
    it('should handle validation errors from class-validator', () => {
      const host = mockArgumentsHost();
      const error = new HttpException(
        {
          message: [
            { property: 'email', value: 'bad', constraints: { isEmail: 'email must be valid' } },
          ],
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(error, host as never);

      const payload = getLastSendPayload(host.switchToHttp().getResponse());
      expect((payload?.error as Record<string, unknown>).code).toBe('VALIDATION_FAILED');
      expect(
        (payload?.error as Record<string, unknown>).details as Array<Record<string, unknown>>,
      ).toHaveLength(1);
    });

    it('should handle plain string exceptions', () => {
      const host = mockArgumentsHost();
      const error = new HttpException('Not found', HttpStatus.NOT_FOUND);

      filter.catch(error, host as never);

      const payload = getLastSendPayload(host.switchToHttp().getResponse());
      expect((payload?.meta as Record<string, unknown>).statusCode).toBe(404);
      expect((payload?.error as Record<string, unknown>).code).toBe('NOT_FOUND');
    });
  });

  describe('Unknown error', () => {
    it('should return 500 with hidden message in production', () => {
      configService.get.mockReturnValue('production');
      const host = mockArgumentsHost();

      filter.catch(new Error('sensitive details'), host as never);

      const payload = getLastSendPayload(host.switchToHttp().getResponse());
      expect((payload?.meta as Record<string, unknown>).statusCode).toBe(500);
      expect((payload?.error as Record<string, unknown>).message).toBe('Internal server error');
    });

    it('should show error message in development', () => {
      configService.get.mockReturnValue('development');
      const host = mockArgumentsHost();

      filter.catch(new Error('debug details'), host as never);

      const payload = getLastSendPayload(host.switchToHttp().getResponse());
      expect((payload?.error as Record<string, unknown>).message).toBe('debug details');
    });
  });

  describe('Request metadata', () => {
    it('should include requestId, traceId, path, method', () => {
      const host = mockArgumentsHost('/api/users', 'POST');
      const error = new ApplicationError('Test', 'TEST', 400);

      filter.catch(error, host as never);

      const payload = getLastSendPayload(host.switchToHttp().getResponse());
      const meta = payload?.meta as Record<string, unknown>;
      expect(meta.requestId).toBe('req-123');
      expect(meta.traceId).toBe('trace-456');
      expect(meta.path).toBe('/api/users');
      expect(meta.method).toBe('POST');
    });
  });
});
