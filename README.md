# NestJS Base — Enterprise Boilerplate

NestJS Base là boilerplate chuyên nghiệp cho ứng dụng backend enterprise, được xây dựng với tư duy **Domain-Driven Design** (DDD) và **Clean Architecture**. Dự án ưu tiên khả năng mở rộng, bảo trì và hiệu suất cao.

---

## 🏗 Kiến trúc tổng quan

Ứng dụng được tổ chức theo mô hình **Modular Monolith** với các tầng phân tách rõ ràng:

```
src/
├── main.ts                     # Entry point (Fastify adapter)
├── common/
│   ├── domain/                 # Base class: BaseEntity, BaseEvent, BaseValueObject + Domain Errors
│   ├── decorators/             # @Public(), @Roles(), @CurrentUser(), @Throttle()...
│   ├── filters/                # GlobalExceptionFilter (xử lý mọi exception tập trung)
│   ├── guards/                 # AuthGuard, AuthorizationGuard, CustomThrottlerGuard...
│   ├── interceptors/           # Logging, Response, AuditLog
│   ├── interfaces/             # BaseResponse<T>
│   ├── repositories/           # TypeOrmBaseRepository (abstract generic)
│   ├── services/               # Logger, Cache, Transaction, PasswordHasher, ResourceOwnership...
│   ├── types/                  # Pagination types, Query types
│   └── utils/                  # Test helpers, pagination utility, env transform...
├── config/                     # Config namespaces (app, database, redis, auth, cache, security, throttler)
├── constants/                  # Hằng số + injection tokens
├── i18n/                       # Đa ngôn ngữ (EN, ES)
└── modules/                    # Feature modules
    ├── auth/                   # Xác thực & phân quyền
    ├── user/                   # Quản lý người dùng
    ├── product/                # Quản lý sản phẩm (ví dụ CRUD)
    ├── notification/           # Hàng đợi email async (BullMQ)
    ├── health/                 # Health checks (Terminus)
    ├── metrics/                # Prometheus metrics
    ├── redis/                  # Redis client (ioredis)
    └── typeorm/                # TypeORM module + error mapper
```

### Mỗi feature module tuân theo Clean Architecture:

```
modules/<feature>/
├── domain/
│   ├── entities/               # Rich domain model
│   ├── repositories/           # Interface repository
│   ├── value-objects/          # Value object (VD: Email)
│   ├── events/                 # Domain events
│   └── enums/                  # Enum
├── application/
│   └── use-cases/              # Use case / Service
├── infrastructure/
│   ├── orm/                    # TypeORM entity (extends BaseEntity)
│   └── repositories/           # Implement repository interface
└── presentation/
    ├── controllers/            # Route handlers
    └── dtos/                   # Request/Response DTO
```

---

## 🛠 Technology Stack

| Layer          | Công nghệ                                                              |
| -------------- | ---------------------------------------------------------------------- |
| **Runtime**    | Node.js 22+, TypeScript 5.7 (strict mode)                              |
| **Framework**  | NestJS 11 (Fastify adapter)                                            |
| **Database**   | PostgreSQL 16 + TypeORM                                                |
| **Caching**    | Redis 7 (ioredis + cache-manager)                                      |
| **Queue**      | BullMQ (background jobs)                                               |
| **Auth**       | Passport (JWT + Local strategy), Argon2 (hash), refresh token rotation |
| **Validation** | class-validator + class-transformer                                    |
| **API Docs**   | Swagger / OpenAPI 3.0                                                  |
| **Logging**    | Pino (structured JSON)                                                 |
| **Metrics**    | Prometheus client                                                      |
| **i18n**       | nestjs-i18n (EN, ES)                                                   |
| **CLS**        | nestjs-cls (requestId, traceId)                                        |
| **Email**      | SendGrid / AWS SES (template)                                          |
| **Storage**    | AWS S3 / Cloudinary                                                    |
| **Testing**    | Jest + supertest                                                       |
| **CI/CD**      | GitHub Actions + Docker                                                |

---

## 🚀 Bắt đầu nhanh

### 1. Yêu cầu

- Node.js 22+
- pnpm 10+
- Docker (cho PostgreSQL, Redis)

### 2. Cài đặt môi trường

```bash
cp .env.example .env
# Hoặc cho Docker:
cp .env.docker.example .env.docker
```

### 3. Cài dependencies

```bash
pnpm install
```

### 4. Khởi động infrastructure (PostgreSQL + Redis)

```bash
docker compose up -d
```

### 5. Chạy ứng dụng

```bash
# Development
pnpm run start:dev

# Debug
pnpm run start:debug

# Production build
pnpm run build && pnpm run start:prod
```

---

## 📋 Scripts

| Script               | Mô tả                           |
| -------------------- | ------------------------------- |
| `pnpm build`         | Build ứng dụng                  |
| `pnpm start:dev`     | Chạy dev với hot-reload         |
| `pnpm start:prod`    | Chạy production                 |
| `pnpm lint`          | ESLint auto-fix                 |
| `pnpm lint:check`    | ESLint kiểm tra (không fix)     |
| `pnpm lint:strict`   | ESLint strict mode              |
| `pnpm typecheck`     | TypeScript kiểm tra kiểu        |
| `pnpm format`        | Prettier format                 |
| `pnpm format:check`  | Prettier kiểm tra               |
| `pnpm validate:code` | lint + typecheck + format:check |
| `pnpm test`          | Chạy unit test                  |
| `pnpm test:cov`      | Chạy unit test + coverage       |
| `pnpm test:e2e`      | Chạy E2E test                   |

---

## 🔐 Xác thực & Phân quyền

### Luồng xác thực

1. **Đăng nhập**: `POST /api/v1/auth/login` → kiểm tra email/password → trả về access token + refresh token
2. **Access token**: JWT (HS256, thời gian ngắn) gửi qua header `Authorization: Bearer <token>`
3. **Refresh token**: JWT (thời gian dài), hash lưu trong Redis, luân chuyển mỗi lần refresh
4. **Blacklist**: Access token bị vô hiệu hoá khi logout
5. **Global guards** (theo thứ tự): `CustomThrottlerGuard` → `AuthGuard` → `AuthorizationGuard`

### Decorators

| Decorator         | Mục đích                                  |
| ----------------- | ----------------------------------------- |
| `@Public()`       | Bỏ qua xác thực JWT (VD: login, register) |
| `@OptionalAuth()` | Cho phép cả có token và không token       |
| `@Roles('admin')` | Yêu cầu role cụ thể                       |
| `@Throttle(...)`  | Override rate limit cho endpoint          |
| `@SkipThrottle()` | Bỏ qua rate limit                         |
| `@CurrentUser()`  | Lấy thông tin user từ request             |

---

## 📦 Endpoints API

### Health

| Method | Path                   | Mô tả             |
| ------ | ---------------------- | ----------------- |
| GET    | `/api/v1/health`       | Kiểm tra tổng thể |
| GET    | `/api/v1/health/live`  | Liveness probe    |
| GET    | `/api/v1/health/ready` | Readiness probe   |

### Auth

| Method | Path                           | Auth   |
| ------ | ------------------------------ | ------ |
| POST   | `/api/v1/auth/register`        | Public |
| POST   | `/api/v1/auth/login`           | Public |
| POST   | `/api/v1/auth/refresh`         | Public |
| POST   | `/api/v1/auth/logout`          | JWT    |
| POST   | `/api/v1/auth/logout-all`      | JWT    |
| GET    | `/api/v1/auth/me`              | JWT    |
| POST   | `/api/v1/auth/forgot-password` | Public |
| POST   | `/api/v1/auth/reset-password`  | Public |
| PATCH  | `/api/v1/auth/change-password` | JWT    |

### Users

| Method | Path                | Auth  |
| ------ | ------------------- | ----- |
| POST   | `/api/v1/users`     | Admin |
| GET    | `/api/v1/users`     | JWT   |
| GET    | `/api/v1/users/:id` | JWT   |

### Products

| Method | Path                   | Auth  |
| ------ | ---------------------- | ----- |
| POST   | `/api/v1/products`     | Admin |
| GET    | `/api/v1/products/:id` | JWT   |
| GET    | `/api/v1/products`     | JWT   |

### Metrics

| Method | Path              |
| ------ | ----------------- |
| GET    | `/api/v1/metrics` |

---

## 🧪 Testing

```bash
# Unit test
pnpm run test

# Unit test + coverage (ngưỡng 70%)
pnpm run test:cov

# E2E test
pnpm run test:e2e

# Debug test
pnpm run test:debug
```

---

## 🐳 Docker

```bash
# Development (PostgreSQL + Redis)
docker compose up -d

# Production (full stack)
docker compose -f docker-compose.prod.yml up --build -d
```

---

## 📐 Coding Standards

- **Commit convention**: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `build:`...)
- **Pre-commit hook** (Husky): lint-staged → typecheck → format:check → branch naming
- **Commit-msg hook**: commitlint
- **Pre-push hook**: unit test + coverage, chặn commit `.env`
- **ESLint**: Airbnb style guide, strict TypeScript rules, cấm `any`
- **Branch naming**: `feature.xxx`, `bugfix.xxx`, `main`

---

## 🌐 Đa ngôn ngữ (i18n)

Hỗ trợ tiếng Anh (`en`) và tiếng Tây Ban Nha (`es`). File dịch nằm trong `src/i18n/translations/`. Sử dụng `I18nService` từ `nestjs-i18n` để lấy nội dung theo ngôn ngữ.

---

## 📜 Giấy phép

UNLICENSED
