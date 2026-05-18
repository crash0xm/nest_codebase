# 🔍 Full Deep Review — NestJS SaaS Backend Codebase

> Reviewed by: Staff Engineer perspective · Date: 2026-05-18
> Stack: NestJS 11 · TypeORM · PostgreSQL · Redis · BullMQ · Fastify · Pino · Prometheus

---

## 1. Tổng Quan Hệ Thống

### Hệ thống đang làm gì?
Đây là một **NestJS SaaS backend boilerplate/template** cung cấp:
- Authentication (JWT access + refresh token rotation, argon2, blacklist)
- User & Product management
- Role-based authorization (RBAC với permission model)
- Async email notification via BullMQ
- Observability: Prometheus metrics, Pino structured logging, health checks
- Storage/Email provider abstraction (S3, SES, SendGrid)
- i18n (en/es)

### Kiến trúc hiện tại
Monolith modular theo **Domain-Driven Design (DDD) lite** + **Clean Architecture**:
```
presentation (controllers, DTOs)
  ↓
application (use-cases, services)
  ↓
domain (entities, value objects, events, repository interfaces)
  ↓
infrastructure (TypeORM ORM entities, repositories, strategies)
```

### Công nghệ sử dụng
- **Framework**: NestJS 11, Fastify adapter
- **Database**: PostgreSQL + TypeORM 0.3
- **Cache/Queue**: Redis (ioredis), BullMQ, cache-manager-redis-yet
- **Auth**: Passport JWT + Local, argon2, nestjs-cls (correlation ID)
- **Logging**: nestjs-pino (structured JSON)
- **Metrics**: Prometheus (prom-client, @willsoto/nestjs-prometheus)
- **Health**: @nestjs/terminus
- **Email**: SendGrid / AWS SES
- **Storage**: AWS S3
- **CI**: GitHub Actions, Docker multi-stage, husky + commitlint

### Điểm mạnh tổng quát ✅
1. DDD-lite architecture khá sạch — domain không import infrastructure
2. JWT với refresh token rotation + argon2 hash refresh token — đây là mức rất tốt
3. Argon2 cho password hashing (đúng choice, tốt hơn bcrypt)
4. Pino structured logging với redact sensitive fields
5. Prometheus metrics + health checks (liveness/readiness) — production-ready
6. Graceful shutdown + SIGTERM handling đúng
7. Helmet + CORS strict origin matching
8. Rate limiting tại application layer
9. Global validation pipe với whitelist + forbidNonWhitelisted
10. BullMQ cho async job processing (email)
11. Multi-stage Dockerfile với non-root user
12. Husky + commitlint + lint-staged
13. Renovate bot config có sẵn

### Điểm yếu tổng quát ❌
1. **`.env` thật commit lên git** với database credentials (CRITICAL)
2. Dockerfile references `prisma/` nhưng project đã chuyển sang TypeORM — stale
3. `ResourceOwnershipService` hardcode trả `false` — ownership check product bị broken
4. Password reset token dùng cùng secret với access token — security flaw
5. `forgotPassword` log raw reset token — security flaw nghiêm trọng
6. ORM entity design có sự không nhất quán với domain entity (firstName/lastName vs fullName)
7. Không có database migrations (TypeORM migrations strategy còn thiếu)
8. CI/CD chạy `prisma migrate deploy` nhưng project dùng TypeORM
9. Test coverage rất mỏng — chỉ unit test, không có integration test thực sự
10. `useExisting: AuthGuard` trong AppModule dùng sai — cần `useClass`

---

## 2. Đánh Giá Kiến Trúc

### Monolith Modular — Đúng hướng cho giai đoạn này
Project theo Clean Architecture rõ ràng:

```
src/modules/{feature}/
  ├── presentation/      ← controllers, DTOs (HTTP layer)
  ├── application/       ← use-cases, services (orchestration)
  ├── domain/            ← entities, value objects, events, repo interfaces (pure)
  └── infrastructure/    ← TypeORM entities, repositories (I/O)
```

**Nhận xét tích cực:**
- Domain layer không import bất kỳ framework/ORM nào — đúng chuẩn
- Dependency inversion qua injection tokens (`USER_REPOSITORY`) — tốt
- Value objects (`Email`) — đúng DDD

**Vấn đề kiến trúc:**

**1. AuthService vi phạm SRP nặng** — một service làm quá nhiều:
register, login, logout, refreshTokens, forgotPassword, resetPassword, changePassword, getUserById, issueTokenPair. Đây là 8 chức năng khác nhau, nên tách:
```
AuthService         ← login, logout, refresh (token lifecycle)
RegistrationService ← register
PasswordService     ← forgot, reset, change password
```

**2. useExisting: AuthGuard — logic bug nghiêm trọng:**
```typescript
// app.module.ts — WRONG
{ provide: APP_GUARD, useExisting: AuthGuard }
```
`useExisting` yêu cầu token đã được provide ở đâu đó. AuthGuard chưa được provide ở AppModule. Kết quả: guard không được register → toàn bộ endpoint không có authentication. Cần `useClass: AuthGuard`.

**3. ThrottlerModule được setup nhưng rate-limiting dual-layer:**
```typescript
// main.ts — @fastify/rate-limit (global)
await app.register(import('@fastify/rate-limit'), { max: 100, timeWindow: '1 minute' });

// app.module.ts — CustomThrottlerGuard (NestJS)
{ provide: APP_GUARD, useClass: CustomThrottlerGuard }
```
Hai layer rate limit riêng biệt, logic trùng lặp, khó maintain. Chọn một.

**4. Không có migration strategy rõ ràng:**
TypeORM được dùng với `synchronize: true` (mặc định trong nhiều boilerplate). Production với `synchronize: true` = tự động ALTER TABLE → risk mất data.

**5. ProductModule còn rất sơ khai** — chỉ có `createProduct`, không có get/update/delete. Unfinished feature được expose.

### Coupling & Cohesion
- Modules khá decoupled — tốt
- `common/` folder phình to: services, guards, filters, interceptors, decorators, repositories — có thể tách thêm
- `NotificationModule` phụ thuộc vào `user.domain.events` nhưng không import UserModule → coupling ẩn qua EventEmitter

### Điểm kiến trúc: **6.5/10**

---

## 3. Đánh Giá Folder Structure

### Cấu trúc hiện tại
```
src/
  common/          ← cross-cutting concerns
    decorators/
    domain/        ← base entity, base event, error hierarchy
    errors/
    filters/
    guards/
    integrations/  ← email, storage providers
    interceptors/
    pipes/
    repositories/
    services/
    types/
    utils/
  config/          ← typed config per domain
    app/, auth/, cache/, database/, redis/, security/, throttler/
  constants/       ← injection tokens, app/auth/cache constants
  i18n/
  modules/
    app.module.ts
    auth/
    cls/
    health/
    metrics/
    notification/
    product/
    redis/
    typeorm/
    user/
```

**Điểm tốt:**
- Feature-based modules với internal Clean Architecture layers ✅
- Config được tổ chức theo domain với type definitions ✅
- Constants tách riêng khỏi business logic ✅
- i18n có sẵn ✅

**Vấn đề:**

**1. `common/domain/` bị nhầm chỗ:**
`common/domain/base.entity.ts`, `base.value-object.ts` thuộc về shared kernel, không nên ở `common/` (vì common thường là NestJS infrastructure). Nên là `src/shared/domain/`.

**2. `common/integrations/` là third-party adapters:**
Email và Storage providers nên ở `src/infrastructure/` hoặc `src/shared/integrations/` — không nên ở `common/` vì common implies reusable app logic, không phải external adapters.

**3. Enums bị duplicate:**
- `src/modules/user/domain/enums/role.enum.ts` → `Role.USER`, `Role.ADMIN`
- `src/modules/typeorm/entities/enums.ts` → `SystemRole.user`, `SystemRole.admin`

Hai enum song song cho cùng concept, mapping qua `mapRoleToDbRole()` — anti-pattern, dễ gây inconsistency.

**4. `typeorm/entities/refresh-token.entity.ts` bị orphan:**
RefreshToken entity nằm trong `typeorm/entities/` nhưng không có corresponding domain entity, repo, hoặc module feature. Token management hoàn toàn được handle bởi Redis — entity này thừa nếu không dùng.

**Đề xuất cấu trúc tốt hơn:**
```
src/
  shared/
    domain/        ← base entity, value objects, events
    errors/        ← domain, application, infrastructure errors
    kernel/        ← common interfaces
  infrastructure/
    database/      ← TypeORM setup
    redis/
    email/
    storage/
  modules/
    auth/
    user/
    product/
    notification/
  common/          ← NestJS-specific: guards, filters, interceptors, pipes, decorators
  config/
```

---

## 4. Đánh Giá Code Quality

### Vấn đề cụ thể:

**4.1 AuthService.forgotPassword — raw token bị log (CRITICAL):**
```typescript
// auth.service.ts — SECURITY BREACH
this.logger.log(`[Auth] Reset token generated: userId=${user.id} token=${resetToken}`);
```
Reset token là credential nhạy cảm, không bao giờ được log. Nếu log được collect bởi bất kỳ service nào (Datadog, CloudWatch...), attacker có thể dùng token để reset password của user.

**Fix:**
```typescript
this.logger.log(`[Auth] Reset token generated: userId=${user.id}`); // NEVER log token
```

**4.2 resetPassword không thực sự save password:**
```typescript
// auth.service.ts — BUG
user.setPasswordHash(passwordHash); // sets on domain entity in memory
await this.userRepository.update(user.id, {
  firstName: user.firstName,  // chỉ update firstName/lastName/role
  lastName: user.lastName,    // KHÔNG bao gồm passwordHash!
  role: user.role,
});
```
`passwordHash` không bao giờ được persist xuống database. Password reset sẽ không hoạt động.

**Fix:**
```typescript
await this.userRepository.updatePassword(user.id, passwordHash);
// Hoặc expose passwordHash trong UpdateUserDto
```

**4.3 ResourceOwnershipService.isProductOwner hardcoded false:**
```typescript
// resource-ownership.service.ts — BROKEN
private isProductOwner(_productId: string): boolean {
  return false; // Always denies!
}
```
Tất cả user bị deny quyền update/delete product của chính mình. Logic sẽ không hoạt động cho production.

**4.4 TypeORM `update()` — extra SELECT sau mỗi update (N+1 pattern):**
```typescript
// typeorm-base.repository.ts
async update(id: TId, data: Partial<T>): Promise<TEntity> {
  await repo.update(id, data);           // UPDATE query
  const result = await repo.findOne(…); // extra SELECT — unnecessary
  return result;
}
```
Với mỗi update operation, có 2 DB queries. Với high traffic, đây là bottleneck đáng kể. Dùng `save()` hoặc `returning` clause.

**4.5 `like` và `ilike` operators sanitize sai:**
```typescript
// typeorm-base.repository.ts
case 'like':
  where[f.field] = ILike(String(f.value).replace(/%/g, ''));
  break;
```
Xóa `%` từ value nhưng không add wildcards → query không có wildcards = exact match, không phải LIKE. Đúng hơn là:
```typescript
where[f.field] = ILike(`%${String(f.value).replace(/%/g, '\\%')}%`);
```

**4.6 mapToDomain có string parsing thủ công fragile:**
```typescript
// typeorm-user.repository.ts
const fullName = user.fullName ?? '';
const nameParts = fullName.split(' ');
const firstName = nameParts[0] ?? '';
const lastName = nameParts.slice(1).join(' ') ?? '';
```
Tên "Nguyễn Văn A" → `firstName = "Nguyễn"`, `lastName = "Văn A"`. Tên "Madonna" → `lastName = ""`. Đây là anti-pattern — domain entity nên store firstName/lastName riêng.

**4.7 Error messages generic, không dùng custom errors:**
```typescript
// auth.service.ts
throw new Error('User not found');   // generic Error thay vì UserNotFoundException
throw new Error('Current password is incorrect');  // generic Error
```
Generic `Error` không được handle đúng bởi `GlobalExceptionFilter`, dẫn đến 500 internal server error thay vì 404/401 đúng HTTP status.

**4.8 getMe() endpoint gọi repository thêm lần nữa:**
```typescript
// auth.controller.ts
async getMe(@Req() req: LogoutRequest) {
  const fullUser = await this.authService.getUserById(user.id); // extra DB query
  // JWT payload đã có email, role — chỉ cần thêm fullName, isActive
}
```
Cân nhắc include thêm info trong JWT hoặc cache user profile.

**TypeScript Quality:**
- `as unknown as X` casting xuất hiện nhiều trong repositories → type safety bị bypass
- `Record<string, unknown>` overused thay vì typed interfaces
- Missing strict null checks ở một số chỗ

### Điểm Code Quality: **6/10**

---

## 5. Đánh Giá SOLID Principles

### S — Single Responsibility
❌ **Vi phạm**: `AuthService` có 8+ methods bao gồm registration, authentication, password management, token management.

❌ **Vi phạm**: `TypeOrmBaseRepository` vừa là query builder, vừa là logging service, vừa là transaction manager.

### O — Open/Closed
✅ **Tốt**: Provider pattern cho Email/Storage — thêm provider mới không cần sửa existing code.

✅ **Tốt**: Injection token + interface cho repositories — swap implementation không cần sửa use-cases.

### L — Liskov Substitution
✅ **Tốt**: `TypeOrmUserRepository extends TypeOrmBaseRepository` — substitution hợp lý.

⚠️ **Warning**: `handleExecuteError()` in base được gọi ngay sau khi log error nhưng cũng log error trong subclass override → double logging.

### I — Interface Segregation
⚠️ **Vấn đề nhỏ**: `IUserRepository` interface rất lớn:
```typescript
interface IUserRepository {
  findById, findByEmail, findAll, create, update, delete, existsByEmail
}
```
Nên tách: `IUserReader`, `IUserWriter`, `IUserFinder` — dùng đúng interface cho đúng use-case.

### D — Dependency Inversion
✅ **Tốt**: Use-cases phụ thuộc vào interface `IUserRepository`, không phải concrete `TypeOrmUserRepository`.

❌ **Vi phạm nhỏ**: `TypeOrmBaseRepository` import trực tiếp `TypeOrmService` (concrete class), không có interface.

---

## 6. Đánh Giá Security

### 🔴 CRITICAL Vulnerabilities

**C1. `.env` file thật được commit lên git:**
```
DATABASE_URL=postgresql://postgres:Khacduy1212**@localhost:5432/test
```
Đây là real database password trong version control. Cần:
1. Rotate credential ngay lập tức
2. Thêm `.env` vào `.gitignore` (đã có nhưng file vẫn tồn tại trong git history)
3. Audit git history: `git log --all --full-history -- .env`
4. Dùng `git filter-repo` hoặc BFG để remove khỏi history

**C2. Password reset token log ra logs:**
```typescript
this.logger.log(`[Auth] Reset token generated: userId=${user.id} token=${resetToken}`);
```
Fix: Xóa ngay dòng log này.

**C3. Password reset token dùng cùng secret với access token:**
```typescript
// forgotPassword
secret: this.authConf.jwt.accessToken.secret,  // access token secret!

// resetPassword verification
secret: this.authConf.jwt.accessToken.secret,  // same secret
```
Nếu attacker có access token hợp lệ, họ có thể construct reset token payload. Cần secret riêng cho password reset:
```typescript
// auth-config.type.ts — thêm:
passwordReset: { secret: string; expiresIn: string; }
```

**C4. `resetPassword` không persist password về database** (xem 4.2 ở trên) — functionality broken.

### 🟠 HIGH Vulnerabilities

**H1. `useExisting: AuthGuard` bug — authentication không hoạt động:**
```typescript
{ provide: APP_GUARD, useExisting: AuthGuard }
```
Nếu bug này thật sự trigger, toàn bộ protected endpoint có thể bị bypass. Cần verify + fix ngay.

**H2. `isProductOwner` hardcoded `false` — authorization broken cho product:**
Users không thể thực hiện bất kỳ ownership-based action nào trên product.

**H3. Swagger enabled in non-production nhưng check bằng env string:**
```typescript
if (nodeEnv !== 'production') { SwaggerModule.setup(...) }
```
Nếu `NODE_ENV` không được set (undefined), Swagger sẽ được expose. Nên check explicit:
```typescript
if (nodeEnv === 'development' || nodeEnv === 'staging') { ... }
```

**H4. CORS `allowedOrigins` check — server-to-server bypass:**
```typescript
if (!origin) return callback(null, true); // Allow all server-to-server
```
Cho phép tất cả request không có `Origin` header. Trong nhiều trường hợp đây là OK, nhưng nên document explicitly và cân nhắc thêm API key cho server-to-server.

**H5. Redis token store dùng DB index 1 — shared connection:**
```typescript
this.redisTokenStore = redisClient.duplicate();
void this.redisTokenStore.select(1);
```
`duplicate()` sau đó `select(1)` là async nhưng `void` discard promise. Race condition: queries có thể chạy trước khi DB selection hoàn thành.

Fix:
```typescript
await this.redisTokenStore.select(1); // không void
```

### 🟡 MEDIUM Vulnerabilities

**M1. Rate limiting hardcoded trong main.ts:**
```typescript
await app.register(import('@fastify/rate-limit'), { max: 100, timeWindow: '1 minute' });
```
Không đọc từ config — không thể thay đổi giữa environments.

**M2. JWT `exp` claim được tin tưởng từ request object:**
```typescript
type JwtAttachedUser = { exp?: number; }
```
`exp` là optional, nếu undefined thì `blacklistTtl = 900` (fallback). Logic này đúng nhưng không guard case `exp` trong quá khứ (expired token được dùng để logout).

**M3. Không có input length validation trên email/password fields:**
Request với email = 10MB string sẽ pass qua validation (class-validator `@IsEmail()` không có max length). DoS risk.
```typescript
@MaxLength(254) // RFC 5321
@IsEmail()
email: string;
```

**M4. BullMQ job data chứa email — sensitive data in queue:**
```typescript
const jobData = { userId, email, firstName };
await this.notificationQueue.add('send-welcome-email', jobData);
```
Job data được store trong Redis. Nếu Redis không encrypt at rest, email addresses bị exposed.

### 🟢 LOW

**L1. Swagger chỉ có `addBearerAuth()` — không có rate limit docs.**

**L2. Health check `/health/ready` Redis indicator hardcoded `up`:**
```typescript
(): HealthIndicatorResult => { return { redis: { status: 'up' } }; }
```
Redis không được actually checked trong readiness probe.

**L3. `@fastify/cookie` được install nhưng không được register** — dead dependency.

---

## 7. Đánh Giá Database

### Schema Design
**Vấn đề chính: fullName vs firstName/lastName inconsistency:**
```typescript
// ORM entity — lưu fullName
@Column({ name: 'full_name' }) fullName: string | null;

// Domain entity — dùng firstName, lastName
private _firstName: string;
private _lastName: string;
```
Mapping qua string split (`fullName.split(' ')`) — fragile với tên tiếng Việt/Hàn/Nhật.

**Fix**: Lưu `first_name` và `last_name` riêng trong DB, hoặc lưu `full_name` và chỉ dùng `fullName` trong toàn bộ codebase.

### Indexing
```typescript
// user-orm.entity.ts
@Index(['systemRole'])
@Index(['isActive'])
@Index(['createdAt'])
```
Tốt — có basic indexes. Nhưng thiếu composite index cho query phổ biến nhất: `findByEmail`:
```typescript
// MISSING — email query đang dùng unique constraint, không phải explicit index
// Unique constraint tự tạo index nên OK, nhưng cần verify:
@Index(['email'])  // redundant nếu unique, nhưng explicit là tốt hơn
```

**Thiếu soft delete strategy:**
```typescript
// domain entity có deletedAt
deletedAt: Date | null;

// nhưng ORM entity không có deletedAt column!
// TypeORM @DeleteDateColumn chưa được implement
```
`delete` method trong repository chỉ set `isActive = false`, không phải soft delete đúng nghĩa. `deletedAt` trong domain entity không bao giờ được set.

### Query Issues
**Pagination trong `findAll` chỉ filter active users:**
```typescript
filters: [{ field: 'isActive', operator: 'eq', value: true }]
```
Admin không thể xem inactive users qua API hiện tại.

**Không có cursor-based pagination** — `offset/limit` kém hiệu quả với large dataset (>100k rows).

### Migration Strategy
**TypeORM migrations chưa được setup.** Chỉ có `typeorm.module.ts` với DataSource config. `scripts/migrate.sh` tồn tại nhưng có thể call Prisma commands (stale). Production không có migration path.

### Điểm Database: **5.5/10**

---

## 8. Đánh Giá API Design

### Điểm tốt
- RESTful routes đúng chuẩn (POST /auth/register, GET /users/:id)
- Response format nhất quán với `{ success, data, message, meta }`
- HTTP status codes đúng (201 Created, 204 No Content, 409 Conflict)
- Swagger documentation đầy đủ với examples
- API versioning qua URI (`VersioningType.URI`)
- DTO validation với class-validator

### Vấn đề

**8.1 Endpoint naming inconsistency:**
```
POST /auth/logout-all    ← kebab-case
POST /auth/forgot-password ← kebab-case — OK
PATCH /auth/change-password ← kebab-case — OK
```
Consistent, nhưng `logout-all` nên là `POST /auth/sessions/revoke-all` (RESTful resource-based).

**8.2 `GET /users` không require ADMIN role:**
```typescript
// user.controller.ts
@Get()  // No @Roles(Role.ADMIN)
async getUsers(@Query() paginationParams: PaginationParams)
```
Bất kỳ authenticated user nào cũng có thể list tất cả users. Đây là privacy issue.

**8.3 `POST /users` require ADMIN nhưng không verify:**
```typescript
@Roles(Role.ADMIN)
async createUser(@Body() createUserDto: CreateUserDataDto)
```
Nhưng `CreateUserDataDto` (imported từ domain) thay vì dùng `CreateUserDto` (presentation DTO). Type mismatch.

**8.4 `getMe()` return type không có Swagger DTO:**
```typescript
async getMe(): Promise<{
  id: string; email: string; fullName?: string; systemRole: string; ...
}>
```
Return type là inline object, không có Swagger `@ApiResponse` với proper type. Schema được define bằng raw object trong decorator.

**8.5 Pagination response không nhất quán:**
- `GET /users` → trả về `meta.pagination`
- `GET /users/:id` → không có pagination nhưng có `meta.timestamp, meta.requestId`
- Format `meta` object không nhất quán

**8.6 Không có API versioning trong URL thực tế:**
```typescript
app.enableVersioning({ type: VersioningType.URI });
// Nhưng routes không có @Version('1') decorator
// apiPrefix là 'api/v1' — versioning bằng prefix, không phải URI versioning của NestJS
```
Conflict giữa manual prefix `api/v1` và NestJS URI versioning.

---

## 9. Đánh Giá Performance

### N+1 Query Pattern
```typescript
// typeorm-base.repository.ts — N+1 trong mọi update
async update(id, data) {
  await repo.update(id, data);       // Query 1: UPDATE
  const result = await repo.findOne(…); // Query 2: SELECT — unnecessary!
}
```
Với 1000 concurrent update requests → 2000 DB queries. Fix: dùng `returning` clause hoặc restructure.

### Redis Connection Duplication
```typescript
// redis-token-store.ts
this.redisTokenStore = redisClient.duplicate(); // New connection!
```
`duplicate()` tạo connection mới. Nếu có nhiều instances hoặc test runs, connection pool sẽ bị exhausted.

### BullMQ không configured properly
```typescript
// BullModule.forRootAsync — chỉ có host/port/password
// Không có:
// - maxRetriesPerRequest
// - connectTimeout
// - lazyConnect
// - enableReadyCheck
```

### Caching Opportunities bị bỏ qua
`CacheModule` được setup nhưng không được dùng ở bất kỳ use-case hay repository nào. `CacheService` tồn tại nhưng không được inject vào any business logic.

```typescript
// Không có @Cacheable hay manual cache trong:
// - getUserById (frequent read)
// - findByEmail (auth flow hit này mỗi request)
```

### Memory Concerns
```typescript
// app.module.ts
EventEmitterModule.forRoot({
  wildcard: true,
  maxListeners: 20,
})
```
`maxListeners: 20` — nếu có nhiều listeners per event, warning sẽ xuất hiện. Cần monitor.

### WebSocket Scalability
Không có WebSocket. Nếu cần thêm sau, với Fastify sẽ cần `@fastify/websocket` — nên plan trước.

### Giải pháp tối ưu gợi ý:
1. **Cache user profile**: Redis với TTL 5 phút cho `getUserById`
2. **Remove extra SELECT** sau update: dùng `returning` hoặc reconstruct từ input
3. **Connection pooling**: Cấu hình TypeORM pool size based trên load
4. **Read replicas**: Tách read/write DataSource cho scale-out

---

## 10. Đánh Giá DevOps & Production Readiness

### Dockerfile — Có vấn đề nghiêm trọng
```dockerfile
# Stage 1: deps
COPY prisma ./prisma           # ← Prisma! Nhưng project dùng TypeORM
RUN pnpm exec prisma generate  # ← Sẽ fail!

# Stage 3: runner
COPY --from=builder /app/src/generated ./src/generated  # ← Prisma generated types
COPY --from=builder /app/prisma ./prisma                 # ← Prisma schema
```
**Dockerfile hoàn toàn broken** — sẽ fail khi build vì không có prisma folder. Cần rewrite cho TypeORM.

**Fixed Dockerfile:**
```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@latest && pnpm install --frozen-lockfile --prod

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@latest && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
USER appuser
EXPOSE 3000
CMD ["node", "dist/main"]
```

### CI/CD Pipeline
```yaml
# ci.yml — chạy Prisma commands
- name: Prisma Generate & Migrate
  run: |
    pnpm exec prisma generate
    pnpm exec prisma migrate deploy
```
**CI pipeline sẽ fail** vì không có Prisma. Cần thay bằng TypeORM migrations.

**Thiếu trong CI:**
- SAST scan (Snyk, Semgrep)
- Docker image scanning (Trivy)
- Secret scanning (git-secrets, trufflehog)
- Staging deployment trước production
- Smoke tests sau deploy
- Rollback strategy

### Logging
✅ Pino với structured JSON, redact sensitive headers
✅ Correlation ID qua nestjs-cls
⚠️ Log level `debug` trong `.env` — production nên là `info` hoặc `warn`
⚠️ Không có log aggregation setup (Loki, ELK, CloudWatch) trong docs

### Health Checks
✅ `/health`, `/health/live`, `/health/ready` đầy đủ
❌ Redis không được check trong `/health/ready` (hardcoded `up`)
⚠️ Database check dùng raw `SELECT 1` — OK nhưng không test connection pool

### Graceful Shutdown
✅ `enableShutdownHooks()` + SIGTERM/SIGINT handler với timeout
✅ Force exit sau `shutdownTimeout`

### Missing Production Concerns
- **Circuit breaker**: Không có (nếu PostgreSQL down, app sẽ hang)
- **Retry strategy**: Không có cho database queries
- **Backup strategy**: Không được document
- **Secret rotation**: Không có process
- **Feature flags**: Không có
- **APM**: Chỉ Prometheus — không có distributed tracing (Jaeger/Zipkin/OTEL)

---

## 11. Đánh Giá Testing

### Unit Tests
Chỉ có:
- `create-user.use-case.spec.ts`
- `get-user-by-id.use-case.spec.ts`
- `auth.service.spec.ts`
- `email.value-object.spec.ts`
- `app-config.spec.ts`

**Test quality tốt** — mocking đúng, test cases cover happy path và error path.

**Thiếu:**
- Tests cho guards (AuthGuard, AuthorizationGuard)
- Tests cho filters (GlobalExceptionFilter)
- Tests cho interceptors
- Tests cho repositories
- Tests cho password hasher
- Tests cho Redis token store

### Integration Tests
File `test/app.e2e-spec.ts` tồn tại nhưng rỗng — chỉ có boilerplate.

### Coverage
Coverage report được generate nhưng thực tế coverage rất thấp — chỉ 5-6 spec files cho toàn bộ codebase. CI check 70% threshold sẽ fail.

### Test Architecture
✅ `createTestModule` helper — tái sử dụng được
✅ Separation giữa unit test location (bên cạnh file) và e2e test (test/ folder)
❌ Không có database seeder/factory cho integration tests
❌ Không có test container setup

### Điểm Testing: **4/10**

---

## 12. Phân Tích Technical Debt

| Debt | Mức độ nguy hiểm | Ảnh hưởng tương lai | Độ khó refactor |
|------|-------------------|----------------------|-----------------|
| Dockerfile dùng Prisma commands | 🔴 Critical | Build sẽ fail hoàn toàn | Thấp — fix nhanh |
| CI pipeline dùng Prisma migrate | 🔴 Critical | CI không chạy được | Thấp |
| `.env` commit lên git với real credentials | 🔴 Critical | Security breach | Thấp — cleanup + rotate |
| `resetPassword` không persist password | 🔴 Critical | Feature broken hoàn toàn | Thấp |
| `isProductOwner` hardcoded false | 🟠 High | RBAC product bị broken | Thấp |
| `AuthGuard` dùng `useExisting` sai | 🟠 High | Authentication có thể bypass | Thấp |
| firstName/lastName vs fullName split | 🟠 High | Data corruption với special names | Trung bình |
| AuthService quá lớn (8+ methods) | 🟡 Medium | Khó maintain, test | Trung bình |
| Không có TypeORM migrations | 🟡 Medium | Production schema drift | Trung bình |
| N+1 query trong mọi update | 🟡 Medium | Performance bottleneck | Thấp |
| Dual rate limiting layers | 🟡 Medium | Confusing, hard to tune | Thấp |
| Cache setup nhưng không dùng | 🟡 Medium | Wasted infrastructure | Thấp |
| Redis readiness probe hardcoded | 🟡 Medium | False positive trong k8s | Thấp |
| Test coverage < 10% | 🟡 Medium | Regression risk | Cao — cần viết nhiều tests |
| Role enum duplication | 🟢 Low | Mapping bugs | Trung bình |

---

## 13. Refactor Priority

| Priority | Problem | Impact | Suggested Fix |
|----------|---------|--------|---------------|
| P0 | `.env` với real credentials trong git | Security breach | Rotate credentials, clean git history, add `.env` to gitignore properly |
| P0 | Dockerfile broken (Prisma references) | Build fail | Rewrite Dockerfile cho TypeORM |
| P0 | CI pipeline broken (Prisma commands) | CI fail | Replace với TypeORM migration commands |
| P0 | `resetPassword` không save về DB | Feature broken | Fix `userRepository.update()` để include passwordHash |
| P0 | Reset token bị log | Credential leak | Remove log line ngay |
| P1 | `isProductOwner` hardcoded false | RBAC broken | Implement actual ownership query |
| P1 | `APP_GUARD useExisting: AuthGuard` | Auth bypass risk | Change to `useClass: AuthGuard`, verify behavior |
| P1 | Password reset dùng access token secret | Security | Add dedicated `passwordResetSecret` config |
| P1 | Redis `select(1)` với `void` | Race condition | `await this.redisTokenStore.select(1)` |
| P2 | firstName/lastName ORM mismatch | Data corruption | Add `first_name`, `last_name` columns to DB |
| P2 | N+1 query trong `update()` | Performance | Remove extra `findOne` after update |
| P2 | TypeORM migrations | Production risk | Setup `typeorm migration:generate`, update CI |
| P2 | `AuthService` God Class | Maintainability | Split into 3 services |
| P3 | Cache not used | Wasted infra | Add caching to `getUserById`, `findByEmail` |
| P3 | Redis health check hardcoded | False positive | Implement real Redis ping |
| P3 | `GET /users` no ADMIN guard | Privacy | Add `@Roles(Role.ADMIN)` |
| P3 | Test coverage < 10% | Regression risk | Write tests for guards, filters, repositories |
| P4 | Dual rate limiting | Confusion | Remove one layer (prefer ThrottlerGuard) |
| P4 | Role enum duplication | Inconsistency | Unify to single enum |
| P4 | OTEL/distributed tracing | Observability | Add opentelemetry-node |

---

## 14. Production Risk Report

### 💥 Có thể làm production SẬP

1. **Dockerfile fail to build** — deployment không thể xảy ra nếu Prisma folder không tồn tại
2. **TypeORM `synchronize: true` (nếu được dùng)** — ALTER TABLE tự động có thể drop columns → data loss
3. **Redis connection exhaustion** — `redisClient.duplicate()` tạo extra connection mỗi lần RedisTokenStore được instantiate

### 🧠 Memory Leak Risks

1. **EventEmitter listeners** — nếu `@OnEvent` handlers không được cleanup đúng khi module destroy
2. **BullMQ queue không có concurrency limit** — nhiều heavy jobs chạy concurrent → OOM
3. **`redisTokenStore.duplicate()` connections** không được properly closed nếu `onModuleDestroy` không chạy

### 🔓 Security Breach Risks

1. **Real database password trong git** — credentials đã leaked
2. **Reset token bị log** — nếu logs được collect, token có thể bị steal
3. **`isProductOwner = false`** — users không thể manage resources, nhưng ADMIN có thể over-delete

### 💾 Data Corruption Risks

1. **`resetPassword` không persist** → users với "reset password" flow vẫn dùng old password
2. **`fullName.split(' ')` parsing** → tên với dấu cách đặc biệt bị parse sai
3. **Thiếu database transactions** trong một số multi-step operations (register user + emit event không atomic)

---

## 15. Final Score

| Category | Score | Notes |
|----------|-------|-------|
| Architecture | 6.5/10 | DDD structure tốt, nhưng có god class và dependency issues |
| Security | 5/10 | JWT rotation tốt, nhưng credential leak + broken reset |
| Performance | 6/10 | N+1 queries, cache unused, good infra setup |
| Maintainability | 6/10 | Clean structure, but tech debt accumulating fast |
| Scalability | 6.5/10 | Good foundation (BullMQ, Redis, Prometheus), but no horizontal scale docs |
| Code Quality | 6/10 | TypeScript typing, but bypasses + fragile parsing |
| DevOps | 4/10 | Dockerfile broken, CI broken, Prisma references throughout |
| Testing | 4/10 | Very thin coverage, no integration tests |
| **Overall** | **5.5/10** | **Strong foundation, critical bugs need immediate fixes** |

---

## 16. So Sánh Với GitHub Repos Nổi Tiếng — Bạn Còn Thiếu Gì?

Đây là phân tích so với các NestJS boilerplates được star cao:

### vs. [nestjs/typescript-starter](https://github.com/nestjs/typescript-starter) & [brocoders/nestjs-boilerplate](https://github.com/brocoders/nestjs-boilerplate)

**Bạn CÓ (tốt hơn average):**
- ✅ Argon2 thay vì bcrypt
- ✅ Refresh token rotation + Redis blacklist
- ✅ Fastify adapter (performance)
- ✅ Pino structured logging
- ✅ Prometheus metrics
- ✅ BullMQ jobs
- ✅ DDD-lite architecture
- ✅ Husky + commitlint

**Bạn THIẾU (so với production-grade repos):**

| Feature | Mức độ quan trọng | Giải thích |
|---------|-------------------|------------|
| **OpenTelemetry / Distributed Tracing** | 🔴 Quan trọng | Jaeger/Zipkin để trace request flow across services. Cần khi scale |
| **Database Migrations** | 🔴 Quan trọng | TypeORM migration files, seed data. Không có migrations = không deploy được safely |
| **Email Verification Flow** | 🟠 Cao | `isEmailVerified` có trong entity nhưng không có verification flow |
| **2FA / MFA** | 🟠 Cao | TOTP via speakeasy — standard cho SaaS |
| **Social OAuth** | 🟠 Cao | Google/GitHub OAuth — passport-google-oauth20 |
| **API Key Authentication** | 🟠 Cao | Cho machine-to-machine, webhooks |
| **Tenant/Organization** | 🟠 Cao | Multi-tenancy là core SaaS feature |
| **Audit Log** | 🟡 Trung bình | `audit-log.interceptor.ts` có sẵn nhưng chưa implement |
| **GDPR / Data Export** | 🟡 Trung bình | Right to be forgotten, data portability |
| **Webhook System** | 🟡 Trung bình | Outbound webhooks cho integrations |
| **Feature Flags** | 🟡 Trung bình | LaunchDarkly / Unleash integration |
| **Background Job Dashboard** | 🟡 Trung bình | BullMQ Board / Bull Dashboard cho job monitoring |
| **Idempotency Keys** | 🟡 Trung bình | Cho payment và critical operations |
| **Cursor Pagination** | 🟡 Trung bình | Offset pagination không scale |
| **OpenAPI / Swagger Validation** | 🟡 Trung bình | `swagger-stats`, request/response validation từ schema |
| **Changelog / CHANGELOG.md** | 🟢 Thấp | Automation với conventional-changelog |
| **k8s Manifests / Helm Chart** | 🟢 Thấp | Production deployment target |
| **Makefile** | 🟢 Thấp | Common task runner cho dev UX |
| **Performance test** | 🟢 Thấp | k6 / Artillery load test scripts |
| **Database Seeder** | 🟢 Thấp | Test data for development |

### Roadmap gợi ý — theo thứ tự ưu tiên

**Tuần 1 (Critical fixes):**
1. Fix Dockerfile (remove Prisma references)
2. Fix CI (TypeORM migrations)
3. Rotate database credentials, clean git history
4. Fix `resetPassword` bug
5. Fix `isProductOwner`
6. Remove reset token log

**Tuần 2-3 (Foundation):**
1. TypeORM migration setup
2. Email verification flow
3. Fix firstName/lastName schema
4. Add ADMIN guard to `GET /users`
5. Viết tests cho guards và filters

**Tháng 1 (Features):**
1. OpenTelemetry integration
2. Cursor pagination
3. Audit log implementation
4. Multi-tenancy foundation
5. Social OAuth (Google)

**Tháng 2-3 (Scale):**
1. 2FA/MFA
2. API Key authentication
3. Webhook system
4. Performance testing (k6)
5. k8s manifests

---

*Review hoàn thành. Codebase có foundation tốt và đúng hướng architectural, nhưng có một số critical bugs cần fix trước khi deploy production.*
