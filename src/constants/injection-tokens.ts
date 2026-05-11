/**
 * DI Tokens cho tất cả repositories và external services.
 * Thêm token mới ở đây khi tạo module mới.
 * KHÔNG dùng string — luôn dùng Symbol.
 */
export const INJECTION_TOKENS = {
  // Repositories
  USER_REPOSITORY: Symbol('USER_REPOSITORY'),
  PRODUCT_REPOSITORY: Symbol('PRODUCT_REPOSITORY'),

  // License / Key-Provisioning Repositories
  LICENSE_PRODUCT_REPOSITORY: Symbol('LICENSE_PRODUCT_REPOSITORY'),
  LICENSE_FEATURE_REPOSITORY: Symbol('LICENSE_FEATURE_REPOSITORY'),
  LICENSE_PLAN_REPOSITORY: Symbol('LICENSE_PLAN_REPOSITORY'),
  LICENSE_PLAN_FEATURE_REPOSITORY: Symbol('LICENSE_PLAN_FEATURE_REPOSITORY'),
  LICENSE_SUBSCRIPTION_REPOSITORY: Symbol('LICENSE_SUBSCRIPTION_REPOSITORY'),

  // External services
  EMAIL_SERVICE: Symbol('EMAIL_SERVICE'),
  STORAGE_SERVICE: Symbol('STORAGE_SERVICE'),

  // Infrastructure
  TOKEN_STORE: Symbol('TOKEN_STORE'),
} as const;

// Export individual tokens for backward compatibility
export const { USER_REPOSITORY } = INJECTION_TOKENS;
export const { EMAIL_SERVICE } = INJECTION_TOKENS;
export const { STORAGE_SERVICE } = INJECTION_TOKENS;
