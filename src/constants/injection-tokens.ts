/**
 * DI Tokens cho tất cả repositories và external services.
 * Thêm token mới ở đây khi tạo module mới.
 * KHÔNG dùng string — luôn dùng Symbol.
 */
export const INJECTION_TOKENS = {
  USER_REPOSITORY: Symbol('USER_REPOSITORY'),
  PRODUCT_REPOSITORY: Symbol('PRODUCT_REPOSITORY'),
  EMAIL_SERVICE: Symbol('EMAIL_SERVICE'),
  STORAGE_SERVICE: Symbol('STORAGE_SERVICE'),
  TOKEN_STORE: Symbol('TOKEN_STORE'),
} as const;

export const { USER_REPOSITORY } = INJECTION_TOKENS;
export const { EMAIL_SERVICE } = INJECTION_TOKENS;
export const { STORAGE_SERVICE } = INJECTION_TOKENS;
