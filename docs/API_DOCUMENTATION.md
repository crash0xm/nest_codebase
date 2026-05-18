# 📚 Tài liệu API

Tài liệu này mô tả tất cả endpoints của ứng dụng NestJS Base. API được tự động tạo tài liệu Swagger/OpenAPI 3.0 tại:

- **Development**: `http://localhost:{PORT}/api/v1/docs`
- **Production**: `https://your-domain.com/api/v1/docs`

---

## Định dạng Response

### Thành công

```typescript
interface BaseResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    timestamp: string; // ISO 8601
    requestId?: string; // CLS request ID
    traceId?: string; // CLS trace ID
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}
```

### Lỗi

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string; // VD: "VALIDATION_FAILED", "USER_NOT_FOUND"
    message: string;
    details?: Array<{
      // Chỉ có ở lỗi validation
      field: string;
      message: string;
      value?: unknown;
    }>;
    context?: Record<string, unknown>;
    location?: {
      // Chỉ có ở development
      function?: string;
      file?: string;
      line?: number;
      column?: number;
    };
  };
  meta: {
    timestamp: string;
    requestId?: string;
    traceId?: string;
    path: string;
    method: string;
    statusCode: number;
  };
}
```

---

## Xác thực

API sử dụng **JWT Bearer Token**. Gửi token trong header:

```http
Authorization: Bearer <access-token>
```

**Access token**: thời gian ngắn (mặc định 15 phút).
**Refresh token**: thời gian dài (mặc định 7 ngày), lưu hash trong Redis, luân chuyển mỗi lần refresh.

---

## Endpoints

### Health (`/api/v1/health`)

Kiểm tra trạng thái ứng dụng và các dependency.

#### GET `/api/v1/health`

Kiểm tra tổng thể: database, memory heap, disk storage.

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up" },
    "disk": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up", "heapUsed": 12345678 },
    "disk": { "status": "up", "storageUsed": 0.45 }
  }
}
```

#### GET `/api/v1/health/live`

Liveness probe cho Kubernetes.

```json
{ "status": "ok", "timestamp": "2026-04-17T08:30:00.000Z" }
```

#### GET `/api/v1/health/ready`

Readiness probe cho Kubernetes (kiểm tra database + Redis).

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

---

### Authentication (`/api/v1/auth`)

#### POST `/api/v1/auth/register`

Tạo tài khoản mới. **Public** (không cần token).

**Request body:**

```json
{
  "email": "nguyen.van.b@gmail.com",
  "password": "Abc@123456",
  "fullName": "Nguyễn Văn B"
}
```

**Response (201):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "550e8400-e29b-41d4-a616-42a8f4ab123",
    "email": "nguyen.van.b@gmail.com",
    "role": "user"
  }
}
```

#### POST `/api/v1/auth/login`

Đăng nhập. **Public**, dùng `LocalAuthGuard` (xác thực email + password).

**Request body:**

```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "550e8400-e29b-41d4-a616-42a8f4ab123",
    "email": "john.doe@example.com",
    "role": "user"
  }
}
```

#### POST `/api/v1/auth/refresh`

Cấp mới access token bằng refresh token. **Public**. Refresh token cũ bị thu hồi (luân chuyển).

**Request body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "550e8400-e29b-41d4-a616-42a8f4ab123",
    "email": "john.doe@example.com",
    "role": "user"
  }
}
```

#### GET `/api/v1/auth/me`

Lấy thông tin user hiện tại. **JWT required**.

**Response (200):**

```json
{
  "id": "550e8400-e29b-41d4-a616-42a8f4ab123",
  "email": "john.doe@example.com",
  "fullName": "John Doe",
  "systemRole": "user",
  "isActive": true,
  "isEmailVerified": true,
  "createdAt": "2026-04-17T08:30:00.000Z",
  "updatedAt": "2026-04-17T08:30:00.000Z"
}
```

#### POST `/api/v1/auth/logout`

Đăng xuất: blacklist access token + thu hồi refresh token. **JWT required**.

**Request body** (tùy chọn):

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response: 204 No Content**

#### POST `/api/v1/auth/logout-all`

Đăng xuất khỏi tất cả thiết bị: thu hồi toàn bộ refresh token của user. **JWT required**.

**Response: 204 No Content**

#### POST `/api/v1/auth/forgot-password`

Gửi email hướng dẫn reset mật khẩu. **Public**. Luôn trả về thành công để tránh lộ thông tin email.

**Request body:**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "If email exists, reset instructions have been sent"
}
```

#### POST `/api/v1/auth/reset-password`

Đặt lại mật khẩu bằng token từ email. **Public**.

**Request body:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Password reset successful"
}
```

#### PATCH `/api/v1/auth/change-password`

Đổi mật khẩu (yêu cầu mật khẩu hiện tại). **JWT required**.

**Request body:**

```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Password changed successful"
}
```

---

### Users (`/api/v1/users`)

Tất cả endpoints User yêu cầu JWT token. Riêng `POST /api/v1/users` yêu cầu role `admin`.

#### POST `/api/v1/users`

Tạo user mới. **Yêu cầu role ADMIN**.

**Request body:**

```json
{
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "password": "SecurePass123!",
  "role": "user"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a616-42a8f4ab123",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "role": "user",
    "isActive": true,
    "isEmailVerified": false,
    "createdAt": "2026-04-17T08:30:00.000Z",
    "updatedAt": "2026-04-17T08:30:00.000Z"
  },
  "message": "User created successfully"
}
```

#### GET `/api/v1/users`

Lấy danh sách user phân trang. **JWT required**.

**Query parameters:**
| Parameter | Type | Mặc định | Mô tả |
|-----------|--------|----------|------------------|
| `page` | number | 1 | Số trang |
| `limit` | number | 10 | Số item mỗi trang |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a616-42a8f4ab123",
      "email": "user1@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe",
      "role": "user"
    }
  ],
  "message": "Users retrieved successfully",
  "meta": {
    "timestamp": "2026-04-17T08:30:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5
    }
  }
}
```

#### GET `/api/v1/users/:id`

Lấy thông tin user theo ID. **JWT required**.

**Path parameter:**
| Parameter | Type | Mô tả |
|-----------|--------|-----------------------------|
| `id` | string | UUID của user (ULID format) |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a616-42a8f4ab123",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "role": "user",
    "isActive": true,
    "isEmailVerified": true,
    "createdAt": "2026-04-17T08:30:00.000Z",
    "updatedAt": "2026-04-17T08:30:00.000Z"
  },
  "message": "User retrieved successfully",
  "meta": {
    "timestamp": "2026-04-17T08:30:00.000Z",
    "requestId": "req-abc",
    "traceId": "trace-xyz"
  }
}
```

---

### Products (`/api/v1/products`)

Module product là module CRUD ví dụ, một số endpoint chưa implement đầy đủ.

#### POST `/api/v1/products`

Tạo sản phẩm mới.

**Request body:**

```json
{
  "name": "Laptop Pro",
  "description": "Laptop hiệu năng cao",
  "price": 25000000,
  "stock": 100
}
```

**Response (201):** Product entity với `id`, `createdAt`, `updatedAt`.

#### GET `/api/v1/products/:id`

Lấy sản phẩm theo ID. **Chưa implement (TODO)**.

#### GET `/api/v1/products`

Lấy danh sách sản phẩm. **Chưa implement (TODO)**.

---

### Metrics (`/api/v1/metrics`)

Prometheus metrics endpoint, dùng cho monitoring. Trả về plain text ở định dạng Prometheus.

---

## Mã lỗi HTTP

| Status | Code                    | Mô tả                             |
| ------ | ----------------------- | --------------------------------- |
| 400    | `VALIDATION_FAILED`     | Validation lỗi (class-validator)  |
| 400    | `BAD_REQUEST`           | Request không hợp lệ              |
| 401    | `INVALID_CREDENTIALS`   | Sai email hoặc mật khẩu           |
| 401    | `UNAUTHORIZED`          | Token không hợp lệ hoặc hết hạn   |
| 401    | `TOKEN_EXPIRED`         | Token đã hết hạn                  |
| 401    | `TOKEN_REVOKED`         | Token đã bị thu hồi               |
| 403    | `FORBIDDEN`             | Không có quyền truy cập           |
| 403    | `ACCOUNT_INACTIVE`      | Tài khoản bị vô hiệu hoá          |
| 403    | `ACCOUNT_DELETED`       | Tài khoản đã bị xoá               |
| 404    | `USER_NOT_FOUND`        | Không tìm thấy user               |
| 404    | `NOT_FOUND`             | Không tìm thấy tài nguyên         |
| 409    | `USER_ALREADY_EXISTS`   | Email đã được đăng ký             |
| 409    | `CONFLICT`              | Xung đột dữ liệu                  |
| 422    | `INVALID_EMAIL`         | Email không hợp lệ (domain error) |
| 429    | `TOO_MANY_REQUESTS`     | Rate limit bị vượt quá            |
| 500    | `INTERNAL_SERVER_ERROR` | Lỗi server không xác định         |
| 503    | `SERVICE_UNAVAILABLE`   | Service tạm thời không hoạt động  |
| 503    | `DATABASE_ERROR`        | Lỗi database                      |
| 503    | `CACHE_ERROR`           | Lỗi cache                         |

---

## Ví dụ lỗi

### Validation Error (400)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "email must be an email" },
      { "field": "password", "message": "password must be longer than or equal to 8 characters" }
    ]
  },
  "meta": {
    "timestamp": "2026-04-17T08:30:00.000Z",
    "requestId": "req-abc",
    "path": "/api/v1/auth/register",
    "method": "POST",
    "statusCode": 400
  }
}
```

### Authentication Error (401)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  },
  "meta": {
    "timestamp": "2026-04-17T08:30:00.000Z",
    "requestId": "req-abc",
    "traceId": "trace-xyz",
    "path": "/api/v1/auth/login",
    "method": "POST",
    "statusCode": 401
  }
}
```

### Forbidden (403)

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Forbidden resource"
  },
  "meta": {
    "timestamp": "2026-04-17T08:30:00.000Z",
    "path": "/api/v1/users",
    "method": "POST",
    "statusCode": 403
  }
}
```

### Not Found (404)

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found"
  },
  "meta": {
    "timestamp": "2026-04-17T08:30:00.000Z",
    "path": "/api/v1/users/550e8400-e29b-41d4-a616-42a8f4ab123",
    "method": "GET",
    "statusCode": 404
  }
}
```

### Rate Limit (429)

```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests, please try again later"
  },
  "meta": {
    "timestamp": "2026-04-17T08:30:00.000Z",
    "path": "/api/v1/auth/login",
    "method": "POST",
    "statusCode": 429
  }
}
```

---

## Chú thích

- Tất cả endpoints đều có prefix `/api/v1`.
- Token được truyền qua header `Authorization: Bearer <token>`.
- Các endpoint Public được đánh dấu `@Public()`, không cần token.
- Các endpoint Admin yêu cầu role `admin`, kiểm tra qua `@Roles()` + `AuthorizationGuard`.
- Global guards áp dụng theo thứ tự: `CustomThrottlerGuard` → `AuthGuard` → `AuthorizationGuard`.
- ID của user có thể là UUID v4 hoặc ULID, tuỳ thuộc vào cấu hình.
- Soft delete được hỗ trợ qua field `deletedAt` (BaseEntity), filter mặc định loại bỏ bản ghi đã xoá.
