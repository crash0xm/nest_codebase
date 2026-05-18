# 🛡 Chiến lược Guard (Global-First)

Hệ thống guard của NestJS Base được thiết kế theo nguyên tắc **bảo mật mặc định** (secure by default): tất cả endpoints đều được bảo vệ, chỉ mở ngoại lệ khi được đánh dấu tường minh.

---

## Kiến trúc Guard

```
Request →
  1. CustomThrottlerGuard     (rate limiting)
  2. Fastify built-in rate limit (fallback 100/min)
  3. AuthGuard                (JWT xác thực + blacklist)
  4. AuthorizationGuard       (role + permission + ownership)
  → Controller handler
```

Các global guards được đăng ký trong `app.module.ts` với scope `APP_GUARD`. Thứ tự thực thi đúng như trên.

Riêng `LocalAuthGuard` không global — nó chỉ được gắn tại **controller handler** của `POST /auth/login`.

---

## CustomThrottlerGuard — Rate Limiting

**File:** `src/common/guards/custom-throttler.guard.ts`

Guard in-memory, chặn request vượt quá ngưỡng cho phép dựa trên IP.

### Cấu hình (`throttler.config.ts`)

| Endpoint          | TTL     | Limit |
| ----------------- | ------- | ----- |
| Mặc định (tất cả) | 60 giây | 100   |
| `/auth/login`     | 15 phút | 5     |
| `/auth/register`  | 15 phút | 5     |
| `/auth/refresh`   | 5 phút  | 10    |
| `/health`         | 1 giây  | 1000  |
| `/metrics`        | 1 giây  | 1000  |

### Headers

Khi bị chặn, response trả về các headers:

- `Retry-After`: số giây chờ
- `X-RateLimit-Limit`: giới hạn tối đa
- `X-RateLimit-Remaining`: số request còn lại
- `X-RateLimit-Reset`: thời điểm reset (ISO 8601)

### Decorators

| Decorator                             | Mục đích                           |
| ------------------------------------- | ---------------------------------- |
| `@Throttle({ limit: 5, ttl: 60000 })` | Override limit cho endpoint cụ thể |
| `@SkipThrottle()`                     | Bỏ qua rate limit hoàn toàn        |

### Whitelist

Cấu hình `THROTTLE_WHITELIST` trong `.env` (danh sách IP phân cách bằng dấu phẩy). Các IP trong whitelist không bị giới hạn.

### Lưu ý

- `CustomThrottlerGuard` sử dụng bộ nhớ trong (Map), sẽ reset khi restart server.
- Có thể mở rộng sang Redis bằng `RedisRateLimitStore` (`rate-limit.guard.ts`) cho production.
- Ngoài ra còn có `@fastify/rate-limit` fallback ở `main.ts` (100 request/phút).

---

## AuthGuard — JWT Authentication

**File:** `src/common/guards/auth.guard.ts`

Guard xác thực **JWT Bearer token** cho mọi request.

### Luồng xử lý

1. Kiểm tra `@Public()` metadata → nếu có, bỏ qua hoàn toàn
2. Trích xuất token từ header `Authorization: Bearer <token>`
3. Nếu không có token:
   - Kiểm tra `@OptionalAuth()` → nếu có, cho qua (request.user = undefined)
   - Nếu không, throw `UnauthorizedException('MISSING_TOKEN')`
4. Verify token với `JwtService.verifyAsync()`:
   - Thuật toán: **HS256** (chặn tấn công `alg: none`)
   - Secret: từ config `auth.jwt.accessToken.secret`
5. Validate payload: `sub`, `email`, `role`, `jti`, `exp` — tất cả bắt buộc
6. Kiểm tra blacklist: token có JTI trong Redis blacklist không?
7. Nếu hợp lệ → gán `request.user = AuthenticatedUser`

### AuthenticatedUser type

```typescript
interface AuthenticatedUser {
  id: string; // userId (từ JWT claim `sub`)
  email: string;
  role: string;
  jti: string; // JWT ID (dùng để blacklist)
  exp: number; // Unix timestamp (giây) (dùng để tính TTL blacklist)
}
```

### Decorators

| Decorator         | Mục đích                                                   |
| ----------------- | ---------------------------------------------------------- |
| `@Public()`       | Bỏ qua xác thực (endpoint public)                          |
| `@OptionalAuth()` | Cho phép cả có token (gán user) và không token (user null) |

### Bảo mật

- Token KHÔNG được đọc từ query string (tránh lộ qua server log, browser history, Referer).
- Mọi lỗi JWT đều trả về message chung `INVALID_OR_EXPIRED_TOKEN` (không tiết lộ nguyên nhân).
- Access token bị logout → blacklist JTI trong Redis.
- Refresh token hash (Argon2) lưu trong Redis, luân chuyển mỗi lần refresh.

---

## LocalAuthGuard — Local Strategy

**File:** `src/common/guards/local-auth.guard.ts`

Guard dùng Passport `local` strategy, chỉ gắn tại `POST /auth/login`.

### Luồng

1. `LocalStrategy` (trong `auth/infrastructure/strategies/local.strategy.ts`) xác thực email + password
2. Gọi `AuthService.validateUser(email, password)`:
   - Tìm user theo email
   - So sánh password hash (Argon2)
   - Kiểm tra account active / deleted
3. Nếu hợp lệ → gán `request.user` = `AuthUserPayload` (id, email, role)
4. `AuthController.login()` nhận user từ request và cấp token pair

---

## AuthorizationGuard — Role & Permission

**File:** `src/common/guards/authorization.guard.ts`

Guard phân quyền dựa trên role và permission. Chạy **sau** AuthGuard nên `request.user` đã có sẵn.

### Kiến trúc phân quyền

Hệ thống phân quyền dạng **RBAC + Permission**: mỗi role có một tập permission cố định. User không thể gán permission động — permission đi kèm với role.

### Role hierarchy

```
SUPER_ADMIN → mọi quyền, bypass mọi check
ADMIN       → user:* (read/update/delete all) + product:*
MODERATOR   → user:*:own + product:* (read/create) + product:*:own (update/delete)
USER        → user:*:own + product:* (read/create) + product:*:own (update/delete)
```

### Permission matrix

| Role          | user:read:own | user:write:own | user:read:all | user:write:all | product:read | product:create | product:write:own | product:write:all |
| ------------- | :-----------: | :------------: | :-----------: | :------------: | :----------: | :------------: | :---------------: | :---------------: |
| **USER**      |      ✅       |       ✅       |      ❌       |       ❌       |      ✅      |       ✅       |        ✅         |        ❌         |
| **MODERATOR** |      ✅       |       ✅       |      ❌       |       ❌       |      ✅      |       ✅       |        ✅         |        ✅         |
| **ADMIN**     |      ✅       |       ✅       |      ✅       |       ✅       |      ✅      |       ✅       |        ✅         |        ✅         |

### Decorators

| Decorator                       | Mục đích                              |
| ------------------------------- | ------------------------------------- |
| `@Roles('ADMIN')`               | Yêu cầu role cụ thể (array, OR logic) |
| `@Roles(Role.ADMIN, Role.USER)` | Nhiều role (OR)                       |
| `@Permissions('user:read')`     | Yêu cầu permission cụ thể             |

### Ownership

Permission có điều kiện `own` — kiểm tra ownership qua `ResourceOwnershipService`.

**Cách hoạt động:**

1. Guard đọc `request.params['id']` (hoặc `userId`, `productId`)
2. Gọi `ResourceOwnershipService.isOwner(userId, resource, resourceId)`
3. Nếu không có ID trong params (collection endpoint) → bỏ qua ownership check

**ResourceOwnershipService hiện tại:**

| Resource  | Logic kiểm tra                           |
| --------- | ---------------------------------------- |
| `user`    | `userId === resourceId`                  |
| `product` | Luôn trả `false` (chưa có field ownerId) |

Để bật product ownership, cần:

1. Thêm field `ownerId` vào `ProductOrmEntity`
2. Cập nhật `ProductEntity` domain
3. Sửa `ResourceOwnershipService.isProductOwner()` để query thật

### Logging

AuthorizationGuard log các sự kiện quan trọng:

- **SUPER_ADMIN access granted** — mức `auth`
- **Access denied — insufficient role** — mức `security` (kèm IP)
- **Access denied — insufficient permissions** — mức `security` (kèm IP)

---

## Lưu ý cho Developer

### Mở endpoint public

```typescript
@Public()
@Post('login')
async login(@Body() dto: LoginDto) { ... }
```

### Gắn role requirement

```typescript
@Roles(Role.ADMIN)
@Post()
async createUser(@Body() dto: CreateUserDto) { ... }
```

### Gắn permission requirement

```typescript
@Permissions('product:create')
@Post()
async createProduct(@Body() dto: CreateProductDto) { ... }
```

### Quy tắc team

1. **Luôn dùng metadata decorators** (`@Public`, `@Roles`, `@Permissions`) thay vì tự gắn guard thủ công.
2. **Không gắn `@UseGuards(AuthGuard)`** trên controller — authentication là global.
3. Khi cần rule authorization đặc biệt, mở rộng `ResourceOwnershipService` — không viết logic trong guard.
4. Mọi endpoint mới mặc định được bảo vệ bởi global guards. Nếu muốn public, phải dùng `@Public()`.
5. Permission format: `"resource:action"` — validated ngay khi module khởi tạo (`OnModuleInit`).
6. SUPER_ADMIN bypass mọi role/permission check — chỉ dùng cho hệ thống.
