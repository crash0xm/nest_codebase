import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLoggerService, LogContext } from '@/common/services/logger.service';

export interface ApiTestResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
  cookies: Record<string, string>;
}

interface InjectResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  json: () => unknown;
  payload?: unknown;
}

export class ApiTestClient {
  private app: INestApplication;
  private baseUrl: string;
  private cookies: Record<string, string> = {};

  constructor(
    app: INestApplication,
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.app = app;
    this.baseUrl = `http://localhost:${this.configService.get('app.port', 3000)}`;
  }

  async get<T = unknown>(
    endpoint: string,
    options?: {
      headers?: Record<string, string>;
      query?: Record<string, unknown>;
    },
  ): Promise<ApiTestResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    this.logger.trace(`API GET: ${url}`, LogContext.HTTP, {
      method: 'GET',
      url,
      headers: options?.headers,
      query: options?.query,
    });

    const response = await (
      (this.app as unknown) as { inject: (options: unknown) => Promise<InjectResponse> }
    ).inject({
      method: 'GET',
      url,
      headers: {
        ...options?.headers,
        cookie: this.formatCookies(),
      },
      query: options?.query,
    });

    return this.formatResponse<T>(response);
  }

  async post<T = unknown>(
    endpoint: string,
    data?: T,
    options?: {
      headers?: Record<string, string>;
      query?: Record<string, unknown>;
    },
  ): Promise<ApiTestResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    this.logger.trace(`API POST: ${url}`, LogContext.HTTP, {
      method: 'POST',
      url,
      data,
      headers: options?.headers,
      query: options?.query,
    });

    const response = await (
      (this.app as unknown) as { inject: (options: unknown) => Promise<InjectResponse> }
    ).inject({
      method: 'POST',
      url,
      headers: {
        ...options?.headers,
        cookie: this.formatCookies(),
      },
      query: options?.query,
      payload: data,
    });

    return this.formatResponse<T>(response);
  }

  async put<T = unknown>(
    endpoint: string,
    data?: T,
    options?: {
      headers?: Record<string, string>;
      query?: Record<string, unknown>;
    },
  ): Promise<ApiTestResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    this.logger.trace(`API PUT: ${url}`, LogContext.HTTP, {
      method: 'PUT',
      url,
      data,
      headers: options?.headers,
      query: options?.query,
    });

    const response = await (
      (this.app as unknown) as { inject: (options: unknown) => Promise<InjectResponse> }
    ).inject({
      method: 'PUT',
      url,
      headers: {
        ...options?.headers,
        cookie: this.formatCookies(),
      },
      query: options?.query,
      payload: data,
    });

    return this.formatResponse<T>(response);
  }

  async patch<T = unknown>(
    endpoint: string,
    data?: T,
    options?: {
      headers?: Record<string, string>;
      query?: Record<string, unknown>;
    },
  ): Promise<ApiTestResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    this.logger.trace(`API PATCH: ${url}`, LogContext.HTTP, {
      method: 'PATCH',
      url,
      data,
      headers: options?.headers,
      query: options?.query,
    });

    const response = await (
      (this.app as unknown) as { inject: (options: unknown) => Promise<InjectResponse> }
    ).inject({
      method: 'PATCH',
      url,
      headers: {
        ...options?.headers,
        cookie: this.formatCookies(),
      },
      query: options?.query,
      payload: data,
    });

    return this.formatResponse<T>(response);
  }

  async delete<T = unknown>(
    endpoint: string,
    options?: {
      headers?: Record<string, string>;
      query?: Record<string, unknown>;
    },
  ): Promise<ApiTestResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    this.logger.trace(`API DELETE: ${url}`, LogContext.HTTP, {
      method: 'DELETE',
      url,
      headers: options?.headers,
      query: options?.query,
    });

    const response = await (
      (this.app as unknown) as { inject: (options: unknown) => Promise<InjectResponse> }
    ).inject({
      method: 'DELETE',
      url,
      headers: {
        ...options?.headers,
        cookie: this.formatCookies(),
      },
      query: options?.query,
    });

    return this.formatResponse<T>(response);
  }

  setAuth(token: string): void {
    this.cookies['auth-token'] = token;
  }

  clearAuth(): void {
    delete this.cookies['auth-token'];
  }

  private formatCookies(): string {
    return Object.entries(this.cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }

  private formatResponse<T>(response: InjectResponse): ApiTestResponse<T> {
    const headers: Record<string, string> = {};
    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        headers[key] = Array.isArray(value) ? value.join(',') : (value ?? '');
      });
    }

    const cookies: Record<string, string> = {};
    const setCookieHeader = response.headers?.['set-cookie'];
    if (setCookieHeader) {
      const cookieStrings = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
      cookieStrings.forEach((cookieString: string) => {
        const [name] = cookieString.split('=');
        if (name) {
          cookies[name] = cookieString;
        }
      });
    }

    return {
      status: response.statusCode,
      data: (response.json ? response.json() : response.payload) as T,
      headers,
      cookies,
    };
  }
}

export class ApiTestAssertions {
  static assertStatus<T>(
    response: ApiTestResponse<T>,
    expectedStatus: number,
    message?: string,
  ): void {
    if (response.status !== expectedStatus) {
      throw new Error(message ?? `Expected status ${expectedStatus}, but got ${response.status}`);
    }
  }

  static assertSuccess(response: ApiTestResponse, message?: string): void {
    this.assertStatus(response, 200, message ?? 'Expected success response');
  }

  static assertCreated(response: ApiTestResponse, message?: string): void {
    this.assertStatus(response, 201, message ?? 'Expected created response');
  }

  static assertBadRequest(response: ApiTestResponse, message?: string): void {
    this.assertStatus(response, 400, message ?? 'Expected bad request response');
  }

  static assertUnauthorized(response: ApiTestResponse, message?: string): void {
    this.assertStatus(response, 401, message ?? 'Expected unauthorized response');
  }

  static assertForbidden(response: ApiTestResponse, message?: string): void {
    this.assertStatus(response, 403, message ?? 'Expected forbidden response');
  }

  static assertNotFound(response: ApiTestResponse, message?: string): void {
    this.assertStatus(response, 404, message ?? 'Expected not found response');
  }

  static assertConflict(response: ApiTestResponse, message?: string): void {
    this.assertStatus(response, 409, message ?? 'Expected conflict response');
  }

  static assertDataStructure<T>(
    response: ApiTestResponse<T>,
    expectedStructure: T,
    message?: string,
  ): void {
    if (!this.matchesStructure(response.data, expectedStructure)) {
      throw new Error(message ?? 'Response data structure does not match expected structure');
    }
  }

  static assertContains<T>(
    response: ApiTestResponse<T>,
    expectedValue: unknown,
    path?: string,
    message?: string,
  ): void {
    const actualValue = path ? this.getNestedValue(response.data, path) : response.data;

    if (!this.containsValue(actualValue, expectedValue)) {
      const pathInfo = path ? ` at path "${path}"` : '';
      throw new Error(
        message ?? `Expected response to contain ${JSON.stringify(expectedValue)}${pathInfo}`,
      );
    }
  }

  static assertHeader(
    response: ApiTestResponse,
    headerName: string,
    expectedValue: string,
    message?: string,
  ): void {
    const actualValue = response.headers[headerName.toLowerCase()];
    if (actualValue !== expectedValue) {
      throw new Error(
        message ?? `Expected header ${headerName} to be ${expectedValue}, but got ${actualValue}`,
      );
    }
  }

  private static matchesStructure<T>(actual: T, expected: T): boolean {
    if (typeof actual !== typeof expected) {
      return false;
    }

    if (typeof actual !== 'object' || actual === null) {
      return actual === expected;
    }

    for (const key in expected as object) {
      if (!(key in actual)) {
        return false;
      }

      if (
        !this.matchesStructure(
          (actual as Record<string, unknown>)[key],
          (expected as Record<string, unknown>)[key],
        )
      ) {
        return false;
      }
    }

    return true;
  }

  private static containsValue(actual: unknown, expected: unknown): boolean {
    if (typeof expected === 'string' && typeof actual === 'string') {
      return actual.includes(expected);
    }

    if (Array.isArray(expected) && Array.isArray(actual)) {
      return expected.every((item) => actual.includes(item));
    }

    if (
      typeof expected === 'object' &&
      typeof actual === 'object' &&
      actual !== null &&
      expected !== null
    ) {
      for (const key in expected) {
        if (
          !this.containsValue(
            (actual as Record<string, unknown>)[key],
            (expected as Record<string, unknown>)[key],
          )
        ) {
          return false;
        }
      }
      return true;
    }

    return actual === expected;
  }

  private static getNestedValue<T>(obj: T, path: string): unknown {
    return path
      .split('.')
      .reduce((current: any, key: string) => current?.[key], obj) as unknown;
  }
}

export class TestModuleBuilder {
  private imports: any[] = [];
  private providers: any[] = [];
  private controllers: any[] = [];

  static create(): TestModuleBuilder {
    return new TestModuleBuilder();
  }

  withImport(importModule: unknown): TestModuleBuilder {
    this.imports.push(importModule);
    return this;
  }

  withProvider(provider: unknown): TestModuleBuilder {
    this.providers.push(provider);
    return this;
  }

  withController(controller: unknown): TestModuleBuilder {
    this.controllers.push(controller);
    return this;
  }

  async compile(): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: [...this.imports],
      providers: [...this.providers],
      controllers: [...this.controllers],
    }).compile();
  }
}
