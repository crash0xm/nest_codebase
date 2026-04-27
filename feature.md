# 🌳 Nền Tảng Quản Lý Gia Phả — Tài Liệu Thiết Kế Hệ Thống

> **Phiên bản:** 3.0.0 | **Cập nhật:** Tháng 4/2026
> **Stack:** NestJS · PostgreSQL · React/Next.js · Redis · RabbitMQ · D3.js
> **Hai chức năng cốt lõi:** 📅 Lịch Cúng Giỗ · 🌐 Quan Hệ Họ Hàng (Nội & Ngoại)

---

## 📋 Mục Lục

1. [Tổng Quan Hệ Thống](#1-tổng-quan-hệ-thống)
2. [Kiến Trúc Tổng Thể](#2-kiến-trúc-tổng-thể)
3. [Hệ Thống Phân Quyền Hai Tầng](#3-hệ-thống-phân-quyền-hai-tầng)
4. [Database Schema (ERD)](#4-database-schema-erd)
5. [Thiết Kế API](#5-thiết-kế-api)
6. [Thiết Kế Service Layer](#6-thiết-kế-service-layer)
7. [Code Mẫu Chính](#7-code-mẫu-chính)
8. [Cấu Trúc Thư Mục](#8-cấu-trúc-thư-mục)
9. [Hệ Thống Thông Báo & Nhắc Nhở](#9-hệ-thống-thông-báo--nhắc-nhở)
10. [Hỗ Trợ Lịch Âm](#10-hỗ-trợ-lịch-âm)
11. [Kiến Trúc Frontend & UX](#11-kiến-trúc-frontend--ux)
12. [Bảo Mật & Phân Quyền Chi Tiết](#12-bảo-mật--phân-quyền-chi-tiết)
13. [Chiến Lược Mở Rộng](#13-chiến-lược-mở-rộng)
14. [Tính Năng Nâng Cao](#14-tính-năng-nâng-cao)
15. [DevOps & Hạ Tầng](#15-devops--hạ-tầng)
16. [Lộ Trình Tính Năng](#16-lộ-trình-tính-năng)

---

## 1. Tổng Quan Hệ Thống

### 1.1 Hai Chức Năng Chính

| Chức năng              | Mô tả chi tiết                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📅 **Lịch Cúng Giỗ**   | Quản lý toàn bộ ngày giỗ, sinh nhật, kỷ niệm theo lịch âm & dương. Nhắc nhở tự động (7/3/1/0 ngày trước), hiển thị tháng/tuần/ngày. Hỗ trợ tháng nhuận âm lịch.                  |
| 🌐 **Quan Hệ Họ Hàng** | Xem toàn bộ cây gia phả, phân chia **họ Nội** và **họ Ngoại** rõ ràng bằng màu sắc. Tra cứu "A là gì của tôi?" → trả kết quả tiếng Việt chuẩn (ông nội / bà ngoại / chú họ xa…). |

### 1.2 Nguyên Tắc UX Cốt Lõi

> **Mục tiêu:** Bà nội 70 tuổi cũng dùng được. Người dùng cảm thấy "tôi đang thêm người thân" chứ không phải "tôi đang xây hệ thống phức tạp".

**Quy tắc 1 — Bắt đầu nhỏ, mở rộng dần:**

- ❌ Tệ: Bắt người dùng nhập toàn bộ gia đình ngay lập tức
- ✅ Tốt: Bắt đầu với 1 người (bản thân), hệ thống gợi ý từng bước tiếp theo

**Quy tắc 2 — Người dùng không cần nghĩ về cấu trúc:**

- ❌ Tệ: "Chọn loại quan hệ: parent_child / spouse"
- ✅ Tốt: "Người này là \_\_\_ của bạn?" → Bố / Mẹ / Vợ / Chồng / Con / Anh / Chị…

**Quy tắc 3 — Luôn hiển thị ngữ cảnh:**

- Mỗi màn hình phải trả lời: "Đây là ai?" và "Họ quan hệ thế nào với tôi?"

**Quy tắc 4 — Phân biệt Nội / Ngoại rõ ràng:**

- Họ Nội (cha) và Họ Ngoại (mẹ) được hiển thị bằng màu sắc và nhóm riêng biệt
- 🔵 Xanh dương = Họ Nội | 🟢 Xanh lá = Họ Ngoại

### 1.3 Điểm Khác Biệt

- **Việt Nam đầu tiên**: Lịch âm đầy đủ (Can Chi, tháng nhuận), giỗ chạp, Tết
- **Engine quan hệ**: Giải thích quan hệ bằng tiếng Việt ("ông nội", "chú họ xa")
- **Phân nhánh Nội/Ngoại**: Hiển thị 2 nhánh họ riêng biệt trong cùng một cây
- **Nhắc nhở thông minh**: 7 ngày / 3 ngày / 1 ngày / Ngày diễn ra
- **Import/Export GEDCOM**: Tương thích với các phần mềm gia phả toàn cầu
- **Phân quyền hai tầng**: System Role (Admin/User) + Tree Role (Owner/Editor/Viewer)

---

## 2. Kiến Trúc Tổng Thể

### 2.1 Sơ Đồ Kiến Trúc Cao

```
┌──────────────────────────────────────────────────────────────────┐
│                            CLIENTS                                │
│   Next.js Web App (User)  │  Admin Dashboard  │  REST API Client  │
└──────────┬────────────────┴──────┬────────────┴──────────┬────────┘
           │                      │                        │
           └──────────────────────▼────────────────────────┘
                            ┌─────────────┐
                            │ API Gateway │
                            │  (NestJS)   │
                            │  + JWT Auth │
                            │  + RBAC     │
                            └──────┬──────┘
               ┌──────────────────┼──────────────────────┐
               ▼                  ▼                       ▼
      ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐
      │  Core API    │  │  Event Worker    │  │  Notification   │
      │  Modules     │  │  (RabbitMQ)      │  │  Service        │
      │  + Admin API │  └───────┬──────────┘  └────────┬────────┘
      └──────┬───────┘          │                      │
             │                  │                      │
      ┌──────▼──────────────────▼──────────────────────▼────────┐
      │                       Data Layer                         │
      │   PostgreSQL  │  Redis (Cache)  │  S3 (Avatars/Files)    │
      └──────────────────────────────────────────────────────────┘
```

### 2.2 Hai Tầng Phân Quyền (Tổng Quan)

```
┌─────────────────────────────────────────────────────┐
│              TẦNG 1: SYSTEM ROLE                     │
│  Xác định quyền trên toàn bộ nền tảng               │
│                                                      │
│  👑 ADMIN  →  Quản lý hệ thống, người dùng, logs    │
│  👤 USER   →  Sử dụng các tính năng gia phả         │
└────────────────────────┬────────────────────────────┘
                         │ USER có thêm
┌────────────────────────▼────────────────────────────┐
│              TẦNG 2: TREE ROLE                       │
│  Xác định quyền trong từng cây gia phả               │
│                                                      │
│  🏠 OWNER   →  Toàn quyền với cây gia phả của mình  │
│  ✏️  EDITOR  →  Chỉnh sửa nội dung cây được chia sẻ │
│  👁️  VIEWER  →  Chỉ xem cây được chia sẻ            │
└─────────────────────────────────────────────────────┘
```

### 2.3 Tại Sao Chọn RabbitMQ Thay Vì BullMQ?

| Tiêu chí            | BullMQ (Redis)          | RabbitMQ                  | Lý do chọn RabbitMQ                                            |
| ------------------- | ----------------------- | ------------------------- | -------------------------------------------------------------- |
| Routing linh hoạt   | ❌ Đơn giản             | ✅ Exchange/Routing Key   | Cần định tuyến theo loại sự kiện (giỗ / sinh nhật / tùy chỉnh) |
| Độ bền message      | Tốt (Redis persistence) | Tốt hơn (disk-based)      | Message giỗ không được mất                                     |
| Fan-out (1 → nhiều) | Cần cấu hình thêm       | ✅ Fanout Exchange        | Thông báo 1 sự kiện tới nhiều kênh (email + push + in-app)     |
| Dead Letter Queue   | Hạn chế                 | ✅ Native DLQ             | Xử lý lỗi gửi thông báo thất bại                               |
| Dashboard quản lý   | Bull Board              | ✅ RabbitMQ Management UI | Dễ theo dõi hơn                                                |
| Độc lập với Redis   | ❌ Phụ thuộc            | ✅ Độc lập                | Không muốn Redis gánh cả cache lẫn queue                       |

### 2.4 Kiến Trúc Module (DDD / Clean Architecture)

```
Application Layer    → Use Cases, Commands, Queries (CQRS)
Domain Layer         → Entities, Value Objects, Domain Services, Events
Infrastructure Layer → Repositories, ORM, External APIs, RabbitMQ
Presentation Layer   → Controllers, DTOs, Guards, Interceptors
```

### 2.5 Kiến Trúc RabbitMQ

```
                    ┌─────────────────────────────┐
                    │      NestJS API Service      │
                    │  (Publisher / Producer)      │
                    └─────────────┬────────────────┘
                                  │ Publish
                    ┌─────────────▼────────────────┐
                    │   Exchange: family.events     │
                    │   Type: topic                 │
                    └──┬──────────┬──────────┬──────┘
        Routing Key:   │          │          │
        event.gio      │  event.birthday     │ event.custom
                       ▼          ▼          ▼
               ┌──────────┐ ┌──────────┐ ┌──────────┐
               │ q.gio    │ │q.birthday│ │q.custom  │
               └────┬─────┘ └────┬─────┘ └────┬─────┘
                    │            │             │
               ┌────▼─────────────▼─────────────▼────┐
               │       Notification Workers            │
               │  (Email Worker / Push Worker /        │
               │   In-App Worker)                      │
               └───────────────────────────────────────┘
                    │
               ┌────▼────┐
               │   DLQ   │  ← Message thất bại → retry → alert admin
               └─────────┘
```

---

## 3. Hệ Thống Phân Quyền Hai Tầng

Đây là phần **cốt lõi** của hệ thống bảo mật. Có **hai tầng độc lập** nhưng phối hợp với nhau.

### 3.1 Tầng 1 — System Role (Vai Trò Hệ Thống)

System Role được lưu trực tiếp trong bảng `users` và kiểm tra tại mọi request API.

| System Role | Mô tả                                                                                                                                                         | Ai được gán                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `admin`     | Quản trị viên nền tảng. Có quyền xem và quản lý toàn bộ hệ thống, người dùng, nội dung vi phạm, logs. **Không can thiệp vào dữ liệu gia phả của người dùng.** | Được gán thủ công bởi admin cấp cao hoặc qua seeding |
| `user`      | Người dùng thông thường. Chỉ truy cập được tài nguyên của chính mình (cây gia phả, thông báo, hồ sơ).                                                         | Tự động khi đăng ký tài khoản                        |

**Quyền của ADMIN (system):**

```
✅ Xem danh sách tất cả người dùng, tìm kiếm, lọc theo trạng thái
✅ Khóa / mở khóa tài khoản người dùng (is_active = false/true)
✅ Xem tổng quan thống kê hệ thống (số user, số cây, số sự kiện)
✅ Xem audit logs toàn hệ thống (ai đã làm gì, khi nào)
✅ Xem danh sách cây gia phả (không xem nội dung chi tiết trừ khi điều tra vi phạm)
✅ Xóa nội dung vi phạm (ảnh, câu chuyện) sau khi xét duyệt
✅ Gửi thông báo hệ thống tới toàn bộ người dùng (maintenance, update)
✅ Quản lý lịch ngày lễ Việt Nam mặc định (Tết, Quốc Khánh…)
✅ Xem dashboard RabbitMQ, trạng thái hàng đợi thông báo
✅ Cấp / thu hồi quyền admin cho tài khoản khác
❌ Không được xem, sửa, xóa dữ liệu gia phả của user (trừ trường hợp điều tra vi phạm có ghi log)
```

**Quyền của USER (system):**

```
✅ Đăng ký, đăng nhập, quản lý hồ sơ cá nhân
✅ Tạo và quản lý cây gia phả của mình (với tree role = owner)
✅ Được mời vào cây của người khác (với tree role = editor / viewer)
✅ Quản lý thông báo, cài đặt cá nhân
✅ Tìm kiếm người thân, tra cứu quan hệ trong cây của mình
✅ Import/Export GEDCOM cây của mình
❌ Không truy cập được dữ liệu của user khác
❌ Không truy cập được các endpoint /api/admin/*
```

### 3.2 Tầng 2 — Tree Role (Vai Trò Trong Cây Gia Phả)

Tree Role được lưu trong bảng `tree_members` và chỉ có hiệu lực trong phạm vi 1 cây gia phả cụ thể.

| Tree Role | Xem | Thêm/Sửa thành viên | Xóa thành viên | Quản lý sự kiện | Chia sẻ cây | Xuất GEDCOM | Xóa cây |
| --------- | --- | ------------------- | -------------- | --------------- | ----------- | ----------- | ------- |
| `owner`   | ✅  | ✅                  | ✅             | ✅              | ✅          | ✅          | ✅      |
| `editor`  | ✅  | ✅                  | ✅             | ✅              | ❌          | ✅          | ❌      |
| `viewer`  | ✅  | ❌                  | ❌             | ❌              | ❌          | ❌          | ❌      |

> **Lưu ý quan trọng:** Khi người dùng tạo cây gia phả, họ được tự động gán tree role = `owner` trong bảng `tree_members`. Admin hệ thống **không** tự động có quyền trong cây gia phả của user.

### 3.3 Ma Trận Phân Quyền Kết Hợp

```
                        System: admin     System: user
                       ┌───────────────┬──────────────────────────────────┐
Tree Role: owner       │  N/A (admin   │  Toàn quyền cây của mình         │
                       │  không có     │  + xem dashboard cá nhân         │
Tree Role: editor      │  tree role)   │  Sửa cây được chia sẻ            │
                       │               │  (không xóa cây, không chia sẻ) │
Tree Role: viewer      │               │  Chỉ xem cây được chia sẻ        │
                       └───────────────┴──────────────────────────────────┘
Endpoint /api/admin/*  │  ✅ Được phép │  ❌ 403 Forbidden                │
Endpoint /api/trees/*  │  ✅ (hạn chế) │  ✅ (theo tree role)             │
Endpoint /api/auth/me  │  ✅           │  ✅                               │
                       └───────────────┴──────────────────────────────────┘
```

### 3.4 Luồng Kiểm Tra Quyền

```
Request đến API
       │
       ▼
[1] JwtAuthGuard
   Xác minh JWT token hợp lệ, decode payload
   → Nếu không hợp lệ: 401 Unauthorized
       │
       ▼
[2] SystemRoleGuard  (chỉ áp dụng cho route có @Roles decorator)
   Kiểm tra user.systemRole có trong danh sách cho phép không
   → Nếu thiếu quyền: 403 Forbidden
       │
       ▼
[3] TreeMemberGuard  (chỉ áp dụng cho route có :treeId)
   Kiểm tra user có trong tree_members của treeId không
   Kiểm tra tree role đủ quyền cho action không
   → Nếu không có quyền: 403 Forbidden
       │
       ▼
[4] Controller xử lý request
```

---

## 4. Database Schema (ERD)

> **Nguyên tắc thiết kế database:** Chuẩn hóa tốt, không cần sửa lại. Mọi trường đều có mục đích rõ ràng.

### 4.1 Bảng Cốt Lõi

```sql
-- ============================================================
-- USERS & XÁC THỰC
-- Lưu thông tin tài khoản và System Role
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    locale          VARCHAR(10) DEFAULT 'vi',            -- 'vi' | 'en'
    timezone        VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh',
    avatar_url      VARCHAR(500),

    -- SYSTEM ROLE: Phân quyền cấp nền tảng
    -- 'admin' = quản trị viên hệ thống
    -- 'user'  = người dùng thông thường (mặc định khi đăng ký)
    system_role     VARCHAR(10) DEFAULT 'user' NOT NULL,
    CONSTRAINT chk_system_role CHECK (system_role IN ('admin', 'user')),

    is_active       BOOLEAN DEFAULT TRUE,               -- Admin có thể khóa tài khoản
    last_login_at   TIMESTAMP WITH TIME ZONE,           -- Theo dõi hoạt động
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_system_role ON users(system_role);
CREATE INDEX idx_users_active ON users(is_active);

-- ============================================================
-- REFRESH TOKENS
-- Lưu refresh token để làm mới access token
-- ============================================================
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,                  -- Hash của token, không lưu raw
    device_info VARCHAR(500),                           -- User-agent / thiết bị
    ip_address  INET,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at  TIMESTAMP WITH TIME ZONE,               -- NULL = còn hiệu lực
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ============================================================
-- CÂY GIA PHẢ
-- Mỗi user có thể tạo nhiều cây (ví dụ: "Họ Nội", "Họ Ngoại")
-- ============================================================
CREATE TABLE family_trees (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,                  -- VD: "Họ Nguyễn - Hà Nội"
    description TEXT,
    cover_url   VARCHAR(500),
    is_public   BOOLEAN DEFAULT FALSE,                  -- Cho phép xem không cần đăng nhập
    member_count INTEGER DEFAULT 0,                     -- Cache đếm số thành viên
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trees_owner ON family_trees(owner_id);
CREATE INDEX idx_trees_public ON family_trees(is_public) WHERE is_public = TRUE;

-- ============================================================
-- TREE MEMBERS — Phân quyền Tree Role
-- Chia sẻ cây với phân quyền theo vai trò
-- owner_id trong family_trees cũng phải có bản ghi ở đây với role='owner'
-- ============================================================
CREATE TABLE tree_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id     UUID REFERENCES family_trees(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,

    -- TREE ROLE: Phân quyền cấp cây gia phả
    -- 'owner'  = toàn quyền, người tạo cây
    -- 'editor' = thêm/sửa/xóa thành viên và sự kiện
    -- 'viewer' = chỉ xem
    role        VARCHAR(10) DEFAULT 'viewer' NOT NULL,
    CONSTRAINT chk_tree_role CHECK (role IN ('owner', 'editor', 'viewer')),

    invited_by  UUID REFERENCES users(id),              -- NULL nếu là owner tự tạo
    joined_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tree_id, user_id)
);

CREATE INDEX idx_tree_members_tree ON tree_members(tree_id);
CREATE INDEX idx_tree_members_user ON tree_members(user_id);

-- ============================================================
-- THÀNH VIÊN GIA ĐÌNH
-- Mỗi bản ghi là một người trong cây gia phả
-- ============================================================
CREATE TABLE persons (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id           UUID REFERENCES family_trees(id) ON DELETE CASCADE,

    full_name         VARCHAR(500) NOT NULL,
    nickname          VARCHAR(255),                     -- Tên thường gọi / tên tục
    gender            VARCHAR(10),                      -- 'male' | 'female' | 'unknown'
    CONSTRAINT chk_gender CHECK (gender IN ('male', 'female', 'unknown')),

    -- Phân nhánh Nội/Ngoại — QUAN TRỌNG
    -- 'paternal' = họ Nội (bên cha)
    -- 'maternal' = họ Ngoại (bên mẹ)
    -- 'self'     = người dùng gốc (root)
    -- NULL       = chưa xác định hoặc hôn nhân (spouse)
    lineage_side      VARCHAR(10),
    CONSTRAINT chk_lineage CHECK (lineage_side IN ('paternal', 'maternal', 'self') OR lineage_side IS NULL),

    -- Ngày tháng (luôn lưu dương lịch; âm lịch tính động)
    birth_date        DATE,
    birth_date_approx BOOLEAN DEFAULT FALSE,            -- Ngày sinh ước tính?
    birth_place       VARCHAR(500),
    death_date        DATE,
    death_place       VARCHAR(500),
    is_alive          BOOLEAN DEFAULT TRUE,

    -- Thông tin cá nhân
    avatar_url        VARCHAR(500),
    biography         TEXT,
    occupation        VARCHAR(255),
    nationality       VARCHAR(100) DEFAULT 'Vietnamese',
    religion          VARCHAR(100),
    education         TEXT,
    address           TEXT,                             -- Địa chỉ hiện tại / quê quán

    -- Đặc thù Việt Nam
    lunar_birth_date  VARCHAR(20),                      -- VD: "15/7/Giáp Ngọ" (lưu để hiển thị)
    generation_number INTEGER,                          -- Đời thứ N
    generation_name   VARCHAR(255),                     -- Tên đệm theo thế hệ (VD: "Văn", "Thị")

    -- Metadata
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at        TIMESTAMP WITH TIME ZONE          -- Xóa mềm (soft delete)
);

CREATE INDEX idx_persons_tree_id ON persons(tree_id);
CREATE INDEX idx_persons_lineage ON persons(tree_id, lineage_side);
CREATE INDEX idx_persons_full_name ON persons USING GIN(to_tsvector('simple', full_name));
CREATE INDEX idx_persons_alive ON persons(tree_id, is_alive);
CREATE INDEX idx_persons_not_deleted ON persons(tree_id) WHERE deleted_at IS NULL;

-- ============================================================
-- QUAN HỆ GIA ĐÌNH
-- Adjacency list — hỗ trợ gia đình phức tạp: tái hôn, con nuôi, v.v.
-- ============================================================
CREATE TABLE relationships (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id           UUID REFERENCES family_trees(id) ON DELETE CASCADE,
    person_a_id       UUID REFERENCES persons(id) ON DELETE CASCADE,
    person_b_id       UUID REFERENCES persons(id) ON DELETE CASCADE,

    relationship_type VARCHAR(30) NOT NULL,
    -- Các loại quan hệ được hỗ trợ:
    -- 'parent_child'        = cha/mẹ và con ruột
    -- 'spouse'              = vợ chồng (kể cả đã ly hôn)
    -- 'adopted_parent_child'= cha/mẹ nuôi và con nuôi
    -- 'step_parent_child'   = cha/mẹ kế và con kế
    CONSTRAINT chk_rel_type CHECK (relationship_type IN (
        'parent_child', 'spouse', 'adopted_parent_child', 'step_parent_child'
    )),

    -- Với parent_child: ai là cha/mẹ?
    direction         VARCHAR(15),                      -- 'a_is_parent' | 'b_is_parent'
    CONSTRAINT chk_direction CHECK (direction IN ('a_is_parent', 'b_is_parent') OR direction IS NULL),

    -- Với spouse: thông tin hôn nhân
    marriage_date     DATE,
    divorce_date      DATE,
    marriage_place    VARCHAR(500),
    is_current_spouse BOOLEAN DEFAULT TRUE,

    notes             TEXT,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT no_self_relation CHECK (person_a_id != person_b_id),
    UNIQUE(tree_id, person_a_id, person_b_id, relationship_type)
);

CREATE INDEX idx_relationships_person_a ON relationships(person_a_id);
CREATE INDEX idx_relationships_person_b ON relationships(person_b_id);
CREATE INDEX idx_relationships_tree ON relationships(tree_id);

-- ============================================================
-- CLOSURE TABLE — Truy vấn tổ tiên/con cháu hiệu quả O(1)
-- Được cập nhật tự động khi thêm quan hệ parent_child
-- Tránh N+1 khi render cây nhiều thế hệ
-- ============================================================
CREATE TABLE person_ancestry (
    ancestor_id     UUID REFERENCES persons(id) ON DELETE CASCADE,
    descendant_id   UUID REFERENCES persons(id) ON DELETE CASCADE,
    depth           INTEGER NOT NULL,                   -- 0=chính mình, 1=cha/mẹ, 2=ông/bà
    path            UUID[],                             -- Mảng UUID trên đường đi
    PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX idx_ancestry_ancestor ON person_ancestry(ancestor_id, depth);
CREATE INDEX idx_ancestry_descendant ON person_ancestry(descendant_id, depth);

-- ============================================================
-- SỰ KIỆN & LỊCH CÚNG GIỖ
-- Đây là bảng trung tâm của chức năng lịch giỗ
-- Sự kiện có thể tự động sinh ra từ thành viên (giỗ, sinh nhật)
-- hoặc do người dùng tạo thủ công (kỷ niệm, lễ tùy chỉnh)
-- ============================================================
CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id         UUID REFERENCES family_trees(id) ON DELETE CASCADE,
    person_id       UUID REFERENCES persons(id) ON DELETE SET NULL,
    -- person_id NULL = sự kiện không gắn với ai cụ thể (VD: Tết, lễ tùy chỉnh)

    event_type      VARCHAR(30) NOT NULL,
    -- 'death_anniversary'  = ngày giỗ (tự động từ death_date của person)
    -- 'birthday'           = sinh nhật (tự động từ birth_date của person)
    -- 'wedding_anniversary'= kỷ niệm ngày cưới (tự động từ marriage_date)
    -- 'tet'                = Tết Nguyên Đán (do hệ thống tạo hàng năm)
    -- 'holiday'            = ngày lễ Việt Nam (admin quản lý)
    -- 'custom'             = tùy chỉnh do người dùng tạo
    CONSTRAINT chk_event_type CHECK (event_type IN (
        'death_anniversary','birthday','wedding_anniversary','tet','holiday','custom'
    )),

    title           VARCHAR(500) NOT NULL,              -- VD: "Giỗ Ông Nội Nguyễn Văn An"
    description     TEXT,
    is_auto_generated BOOLEAN DEFAULT FALSE,            -- TRUE = hệ thống tự sinh (không xóa được bởi editor)

    -- Ngày tháng (luôn lưu ngày dương lịch; tính lại mỗi năm nếu is_lunar=TRUE)
    event_date      DATE NOT NULL,
    end_date        DATE,                               -- Sự kiện kéo dài nhiều ngày

    -- HỖ TRỢ ÂM LỊCH — Cốt lõi cho ngày giỗ Việt Nam
    is_lunar        BOOLEAN DEFAULT FALSE,              -- TRUE = lưu theo âm lịch
    lunar_month     SMALLINT,                           -- 1–12 (hoặc 13 nếu tháng nhuận)
    lunar_day       SMALLINT,                           -- 1–30
    lunar_year_stem VARCHAR(10),                        -- Can (Giáp, Ất, Bính, Đinh...)
    lunar_year_branch VARCHAR(10),                      -- Chi (Tý, Sửu, Dần, Mão...)

    -- Lặp lại hàng năm (hầu hết giỗ/sinh nhật đều lặp lại)
    is_recurring    BOOLEAN DEFAULT TRUE,
    recurrence_rule VARCHAR(255),                       -- Định dạng RRULE (RFC 5545)

    -- Cài đặt nhắc nhở cho sự kiện này (ghi đè cài đặt mặc định của user)
    reminder_days   INTEGER[] DEFAULT '{7,3,1,0}',      -- Nhắc trước 7, 3, 1 ngày và ngày diễn ra

    color           VARCHAR(7) DEFAULT '#E53E3E',       -- Màu hex trên lịch
    icon            VARCHAR(50),                        -- Emoji hoặc tên icon

    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_events_tree_id ON events(tree_id);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_person ON events(person_id);
CREATE INDEX idx_events_type ON events(tree_id, event_type);
CREATE INDEX idx_events_lunar ON events(tree_id, lunar_month, lunar_day)
    WHERE is_lunar = TRUE;
CREATE INDEX idx_events_upcoming ON events(tree_id, event_date, event_type)
    WHERE is_recurring = TRUE;

-- ============================================================
-- THÔNG BÁO
-- Lưu trạng thái từng thông báo đã gửi hoặc cần gửi
-- ============================================================
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
    -- event_id NULL = thông báo hệ thống từ admin

    type            VARCHAR(30) NOT NULL,
    CONSTRAINT chk_notif_type CHECK (type IN ('in_app', 'email', 'push', 'system')),

    title           VARCHAR(500) NOT NULL,
    body            TEXT,

    scheduled_at    TIMESTAMP WITH TIME ZONE NOT NULL,  -- Thời điểm dự kiến gửi
    sent_at         TIMESTAMP WITH TIME ZONE,           -- Thời điểm thực tế đã gửi
    read_at         TIMESTAMP WITH TIME ZONE,

    status          VARCHAR(20) DEFAULT 'pending',
    CONSTRAINT chk_notif_status CHECK (status IN ('pending','sent','failed','read','cancelled')),

    retry_count     INTEGER DEFAULT 0,                  -- Số lần thử lại
    metadata        JSONB DEFAULT '{}',                 -- Dữ liệu bổ sung (VD: FCM token)

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, status);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_at)
    WHERE status = 'pending';
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at)
    WHERE read_at IS NULL AND status = 'sent';

-- ============================================================
-- TÙY CHỈNH THÔNG BÁO
-- Mỗi user có 1 bản ghi cài đặt thông báo
-- ============================================================
CREATE TABLE notification_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,

    email_enabled   BOOLEAN DEFAULT TRUE,               -- Bật gửi email
    push_enabled    BOOLEAN DEFAULT FALSE,              -- Bật push notification (FCM)
    in_app_enabled  BOOLEAN DEFAULT TRUE,               -- Bật thông báo trong app

    -- Nhắc trước N ngày (ghi đè mặc định của từng sự kiện)
    reminder_days   INTEGER[] DEFAULT '{7,3,1,0}',      -- [7, 3, 1, 0] = nhắc 4 lần

    -- Giờ im lặng — không gửi ngoài khoảng này
    quiet_start     TIME DEFAULT '22:00',
    quiet_end       TIME DEFAULT '07:00',

    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TỆP ĐÍNH KÈM — Ảnh, tài liệu, âm thanh của từng thành viên
-- ============================================================
CREATE TABLE person_attachments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id   UUID REFERENCES persons(id) ON DELETE CASCADE,
    tree_id     UUID REFERENCES family_trees(id) ON DELETE CASCADE,

    type        VARCHAR(20) NOT NULL,
    CONSTRAINT chk_attach_type CHECK (type IN ('photo', 'document', 'audio')),

    url         VARCHAR(500) NOT NULL,                  -- S3 URL
    filename    VARCHAR(255),
    caption     TEXT,
    taken_at    DATE,
    file_size   BIGINT,                                 -- Bytes
    mime_type   VARCHAR(100),
    is_avatar   BOOLEAN DEFAULT FALSE,                  -- Ảnh đại diện?

    uploaded_by UUID REFERENCES users(id),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attachments_person ON person_attachments(person_id);
CREATE INDEX idx_attachments_tree ON person_attachments(tree_id);

-- ============================================================
-- KÝ ỨC / CÂU CHUYỆN GIA ĐÌNH
-- Bài viết gắn với một hoặc nhiều thành viên
-- ============================================================
CREATE TABLE family_stories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id     UUID REFERENCES family_trees(id) ON DELETE CASCADE,
    title       VARCHAR(500) NOT NULL,
    content     TEXT,
    story_date  DATE,                                   -- Ngày câu chuyện xảy ra
    location    VARCHAR(500),
    cover_url   VARCHAR(500),                           -- Ảnh bìa của câu chuyện
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Người xuất hiện trong câu chuyện (nhiều-nhiều)
CREATE TABLE story_persons (
    story_id    UUID REFERENCES family_stories(id) ON DELETE CASCADE,
    person_id   UUID REFERENCES persons(id) ON DELETE CASCADE,
    PRIMARY KEY (story_id, person_id)
);

-- ============================================================
-- NHẬT KÝ KIỂM TOÁN (Audit Log)
-- Ghi lại mọi thao tác quan trọng — Admin xem được toàn bộ
-- ============================================================
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),              -- Ai thực hiện?
    tree_id     UUID REFERENCES family_trees(id),       -- Thuộc cây nào? (NULL = hành động system)
    action      VARCHAR(50) NOT NULL,
    -- 'create' | 'update' | 'delete' | 'share' | 'login' | 'logout'
    -- 'export' | 'import' | 'lock_user' | 'unlock_user' | 'grant_admin'
    entity_type VARCHAR(50),                            -- 'person' | 'relationship' | 'event' | 'user' | 'tree'
    entity_id   UUID,
    old_values  JSONB,                                  -- Giá trị trước khi thay đổi
    new_values  JSONB,                                  -- Giá trị sau khi thay đổi
    ip_address  INET,
    user_agent  VARCHAR(500),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_tree ON audit_logs(tree_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);

-- ============================================================
-- THÔNG BÁO HỆ THỐNG (Admin gửi tới toàn bộ user)
-- Khác với notifications — đây là broadcast từ admin
-- ============================================================
CREATE TABLE system_announcements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(500) NOT NULL,
    content     TEXT NOT NULL,
    type        VARCHAR(20) DEFAULT 'info',             -- 'info' | 'warning' | 'maintenance'
    is_active   BOOLEAN DEFAULT TRUE,
    published_at TIMESTAMP WITH TIME ZONE,
    expires_at  TIMESTAMP WITH TIME ZONE,
    created_by  UUID REFERENCES users(id),              -- Phải là admin
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_announcements_active ON system_announcements(is_active, expires_at)
    WHERE is_active = TRUE;
```

### 4.2 Sơ Đồ ERD (Tổng Quan)

```
users (system_role: admin|user)
  ├──< refresh_tokens
  ├──< family_trees (owner_id) >──── tree_members (role: owner|editor|viewer) >── users
  │         │
  │         └──< persons
  │                 │
  │                 ├──< relationships (person_a ↔ person_b)
  │                 ├──< person_ancestry (closure table)
  │                 ├──< person_attachments
  │                 └──< story_persons >── family_stories
  │
  ├──< events (tree_id, person_id)
  │       └──< notifications (user_id, event_id)
  ├──< notification_preferences
  ├──< audit_logs
  └──< system_announcements (admin only)
```

### 4.3 Trường `lineage_side` — Phân Chia Nội/Ngoại

Đây là trường then chốt để phân biệt **họ Nội** (bên cha) và **họ Ngoại** (bên mẹ):

```
Người dùng (root) → lineage_side = 'self'
    │
    ├── [paternal] Bố → lineage_side = 'paternal'
    │       ├── Ông Nội, Bà Nội  → lineage_side = 'paternal'
    │       └── Chú, Bác, Cô     → lineage_side = 'paternal'
    │
    └── [maternal] Mẹ → lineage_side = 'maternal'
            ├── Ông Ngoại, Bà Ngoại → lineage_side = 'maternal'
            └── Cậu, Dì             → lineage_side = 'maternal'

Vợ/Chồng của người thuộc họ Nội/Ngoại → lineage_side = NULL (hôn nhân)
```

- Giá trị `lineage_side` được **tự động suy ra** bởi `LineageSideService` khi tạo quan hệ
- Có thể ghi đè thủ công nếu cây có cấu trúc phức tạp

---

## 5. Thiết Kế API

### 5.1 Quy Tắc Chung

- Tất cả API trả về format chuẩn: `{ success, data, message?, pagination? }`
- Lỗi trả về: `{ success: false, error: { code, message, details? } }`
- Tất cả endpoint yêu cầu `Authorization: Bearer <access_token>` (trừ auth + public)
- Rate limiting: 100 request/phút/IP mặc định, 20 request/phút cho các endpoint nhạy cảm

### 5.2 Xác Thực (Auth)

```
POST   /api/auth/register              Đăng ký tài khoản mới (system_role tự động = 'user')
POST   /api/auth/login                 Đăng nhập, nhận access_token + refresh_token (httpOnly cookie)
POST   /api/auth/refresh               Làm mới access token bằng refresh token
POST   /api/auth/logout                Thu hồi refresh token hiện tại
POST   /api/auth/logout-all            Thu hồi tất cả refresh token (đăng xuất toàn thiết bị)
POST   /api/auth/forgot-password       Gửi link đặt lại mật khẩu qua email
POST   /api/auth/reset-password        Đặt mật khẩu mới bằng reset token
GET    /api/auth/me                    Lấy thông tin người dùng hiện tại (kèm system_role)
PATCH  /api/auth/me                    Cập nhật hồ sơ cá nhân (tên, avatar, locale, timezone)
PATCH  /api/auth/change-password       Đổi mật khẩu (yêu cầu mật khẩu cũ)
```

### 5.3 Cây Gia Phả

```
GET    /api/trees                       Danh sách cây của người dùng (owner + được chia sẻ)
POST   /api/trees                       Tạo cây mới (tự động gán tree_role = owner)
GET    /api/trees/:treeId               Chi tiết cây (kèm thống kê nhanh)
PATCH  /api/trees/:treeId               Cập nhật thông tin cây [owner]
DELETE /api/trees/:treeId               Xóa cây và toàn bộ dữ liệu liên quan [owner]

-- Quản lý thành viên (chia sẻ cây)
POST   /api/trees/:treeId/members               Mời thành viên mới qua email [owner]
GET    /api/trees/:treeId/members               Danh sách thành viên và vai trò [owner/editor]
PATCH  /api/trees/:treeId/members/:userId       Thay đổi tree role của thành viên [owner]
DELETE /api/trees/:treeId/members/:userId       Xóa thành viên khỏi cây [owner]
DELETE /api/trees/:treeId/members/me            Tự rời khỏi cây [editor/viewer]

-- Import / Export
POST   /api/trees/:treeId/import        Import file GEDCOM [owner/editor]
GET    /api/trees/:treeId/export        Export file GEDCOM [owner/editor]
```

### 5.4 Thành Viên Gia Đình (Persons)

```
GET    /api/trees/:treeId/persons                         Danh sách tất cả (có phân trang)
POST   /api/trees/:treeId/persons                         Thêm thành viên mới [editor+]
GET    /api/trees/:treeId/persons/:id                     Chi tiết thành viên
PATCH  /api/trees/:treeId/persons/:id                     Cập nhật thông tin [editor+]
DELETE /api/trees/:treeId/persons/:id                     Xóa mềm [editor+]

-- Truy vấn gia phả
GET    /api/trees/:treeId/persons/:id/relationships       Tất cả quan hệ của người này
GET    /api/trees/:treeId/persons/:id/ancestors           Tổ tiên (dùng closure table)
GET    /api/trees/:treeId/persons/:id/descendants         Con cháu (dùng closure table)
GET    /api/trees/:treeId/persons/:id/timeline            Dòng thời gian cuộc đời

-- File đính kèm
POST   /api/trees/:treeId/persons/:id/avatar              Upload ảnh đại diện [editor+]
GET    /api/trees/:treeId/persons/:id/attachments         Danh sách file đính kèm
POST   /api/trees/:treeId/persons/:id/attachments         Upload file [editor+]
DELETE /api/trees/:treeId/persons/:id/attachments/:fileId Xóa file [editor+]

-- Lọc theo nhánh Nội/Ngoại
GET    /api/trees/:treeId/persons?side=paternal            Chỉ họ Nội
GET    /api/trees/:treeId/persons?side=maternal            Chỉ họ Ngoại
GET    /api/trees/:treeId/persons?alive=true               Chỉ người còn sống
GET    /api/trees/:treeId/persons?generation=3             Lọc theo thế hệ thứ N
```

### 5.5 Quan Hệ Họ Hàng

```
POST   /api/trees/:treeId/relationships                   Tạo quan hệ mới [editor+]
GET    /api/trees/:treeId/relationships/:id               Chi tiết quan hệ
PATCH  /api/trees/:treeId/relationships/:id               Cập nhật quan hệ [editor+]
DELETE /api/trees/:treeId/relationships/:id               Xóa quan hệ [editor+]

-- Tra cứu quan hệ — "A là gì của B?"
GET    /api/trees/:treeId/relationship-query?from=:idA&to=:idB
-- Trả về: nhãn tiếng Việt, tiếng Anh, nhánh Nội/Ngoại, độ sâu, đường đi

-- Lấy dữ liệu cây cho D3.js (render frontend)
GET    /api/trees/:treeId/tree-graph                      Toàn bộ cây dạng graph
GET    /api/trees/:treeId/tree-graph?side=paternal         Chỉ nhánh Nội
GET    /api/trees/:treeId/tree-graph?side=maternal         Chỉ nhánh Ngoại
GET    /api/trees/:treeId/subtree/:id?depth=3              Cây con xung quanh người này (3 thế hệ)
```

### 5.6 Lịch Cúng Giỗ — Chức Năng Chính

```
GET    /api/trees/:treeId/events                          Danh sách sự kiện (có phân trang, lọc)
POST   /api/trees/:treeId/events                          Tạo sự kiện thủ công [editor+]
GET    /api/trees/:treeId/events/:id                      Chi tiết sự kiện
PATCH  /api/trees/:treeId/events/:id                      Cập nhật sự kiện [editor+]
DELETE /api/trees/:treeId/events/:id                      Xóa sự kiện (chỉ non-auto) [editor+]

-- Xem lịch theo tháng (trả về song song dương + âm lịch)
GET    /api/trees/:treeId/calendar?year=2026&month=8
-- Response: { days: [{ solar, lunar, events[], isToday }] }

-- Sự kiện theo thời gian
GET    /api/trees/:treeId/events/upcoming?days=30         Sự kiện trong 30 ngày tới
GET    /api/trees/:treeId/events/today                    Sự kiện hôm nay
GET    /api/trees/:treeId/events/this-week                Sự kiện tuần này

-- Lọc theo loại
GET    /api/trees/:treeId/events?type=death_anniversary   Chỉ ngày giỗ
GET    /api/trees/:treeId/events?type=birthday            Chỉ sinh nhật
GET    /api/trees/:treeId/events?lunar=true               Sự kiện âm lịch
```

### 5.7 Thông Báo

```
GET    /api/notifications                                 Danh sách thông báo của tôi (phân trang)
GET    /api/notifications/unread-count                   Số thông báo chưa đọc
PATCH  /api/notifications/:id/read                       Đánh dấu đã đọc
POST   /api/notifications/mark-all-read                  Đánh dấu tất cả đã đọc
DELETE /api/notifications/:id                            Xóa thông báo

GET    /api/notifications/preferences                    Xem cài đặt thông báo của tôi
PATCH  /api/notifications/preferences                    Cập nhật cài đặt thông báo
```

### 5.8 Tìm Kiếm

```
GET    /api/search?q=:query&treeId=:id                   Tìm toàn văn (người + sự kiện + câu chuyện)
GET    /api/trees/:treeId/persons/search?name=:name       Tìm người theo tên
GET    /api/trees/:treeId/persons/search?q=:q&side=paternal  Tìm người + lọc theo nhánh
```

### 5.9 Ký Ức Gia Đình

```
GET    /api/trees/:treeId/stories                        Danh sách câu chuyện
POST   /api/trees/:treeId/stories                        Tạo câu chuyện mới [editor+]
GET    /api/trees/:treeId/stories/:id                    Chi tiết câu chuyện
PATCH  /api/trees/:treeId/stories/:id                    Cập nhật [editor+]
DELETE /api/trees/:treeId/stories/:id                    Xóa [editor+]
POST   /api/trees/:treeId/stories/:id/persons            Gắn thẻ người vào câu chuyện [editor+]
```

### 5.10 API Admin (Yêu cầu system_role = 'admin')

> Tất cả endpoint `/api/admin/*` đều yêu cầu `system_role = 'admin'`. Trả về 403 nếu là `user` thông thường.

```
-- Dashboard thống kê
GET    /api/admin/dashboard                              Tổng quan: user, cây, sự kiện, thông báo

-- Quản lý người dùng
GET    /api/admin/users                                  Danh sách tất cả người dùng (tìm kiếm, lọc)
GET    /api/admin/users/:id                              Chi tiết người dùng (kèm cây, hoạt động)
PATCH  /api/admin/users/:id/status                       Khóa/mở khóa tài khoản (is_active)
PATCH  /api/admin/users/:id/role                         Thay đổi system_role (gán/thu hồi admin)
DELETE /api/admin/users/:id                              Xóa tài khoản (có xác nhận bổ sung)

-- Quản lý cây gia phả (chỉ xem, không sửa dữ liệu gia phả)
GET    /api/admin/trees                                  Danh sách cây (tìm kiếm, lọc, phân trang)
GET    /api/admin/trees/:id                              Chi tiết cây (metadata, không xem persons)
PATCH  /api/admin/trees/:id/visibility                   Ẩn cây vi phạm (is_public = false)

-- Audit logs
GET    /api/admin/audit-logs                             Xem nhật ký kiểm toán (lọc theo user/action/ngày)
GET    /api/admin/audit-logs?userId=:id                  Log của một user cụ thể
GET    /api/admin/audit-logs?treeId=:id                  Log của một cây cụ thể
GET    /api/admin/audit-logs?action=login                Log đăng nhập

-- Thông báo hệ thống (broadcast)
GET    /api/admin/announcements                          Danh sách thông báo hệ thống
POST   /api/admin/announcements                          Tạo thông báo hệ thống mới
PATCH  /api/admin/announcements/:id                      Cập nhật thông báo
DELETE /api/admin/announcements/:id                      Xóa thông báo

-- Quản lý lịch ngày lễ Việt Nam
GET    /api/admin/holidays                               Danh sách ngày lễ quốc gia
POST   /api/admin/holidays                               Thêm ngày lễ mới
PATCH  /api/admin/holidays/:id                           Cập nhật ngày lễ
DELETE /api/admin/holidays/:id                           Xóa ngày lễ

-- Theo dõi hệ thống
GET    /api/admin/system/stats                           Thống kê kỹ thuật (queue, cache, DB)
GET    /api/admin/system/queue-status                    Trạng thái RabbitMQ queue
POST   /api/admin/system/flush-cache                     Xóa cache Redis (toàn bộ hoặc theo key)
```

### 5.11 Ví Dụ Request/Response

#### POST /api/auth/register

**Request:**

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
  "success": true,
  "data": {
    "user": {
      "id": "uuid-...",
      "email": "nguyen.van.b@gmail.com",
      "fullName": "Nguyễn Văn B",
      "systemRole": "user",
      "locale": "vi",
      "timezone": "Asia/Ho_Chi_Minh"
    },
    "accessToken": "eyJhbGci...",
    "expiresIn": 900
  }
}
```

#### GET /api/auth/me

**Response (200) — User thông thường:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-...",
    "email": "nguyen.van.b@gmail.com",
    "fullName": "Nguyễn Văn B",
    "systemRole": "user",
    "locale": "vi",
    "timezone": "Asia/Ho_Chi_Minh",
    "avatarUrl": null,
    "isActive": true,
    "lastLoginAt": "2026-04-17T08:30:00Z"
  }
}
```

**Response (200) — Admin:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-...",
    "email": "admin@familytree.app",
    "fullName": "Admin Hệ Thống",
    "systemRole": "admin",
    ...
  }
}
```

#### POST /api/trees/:treeId/persons

**Request:**

```json
{
  "fullName": "Nguyễn Văn An",
  "gender": "male",
  "birthDate": "1950-03-15",
  "birthPlace": "Hà Nội, Việt Nam",
  "isAlive": false,
  "deathDate": "2020-08-10",
  "biography": "Cụ là người sáng lập dòng họ tại Hà Nội",
  "occupation": "Giáo viên",
  "lunarBirthDate": "20/2/Canh Dần",
  "generationNumber": 1
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-...",
    "treeId": "tree-uuid",
    "fullName": "Nguyễn Văn An",
    "gender": "male",
    "birthDate": "1950-03-15",
    "lunarBirthDate": "20/2/Canh Dần",
    "lineageSide": null,
    "isAlive": false,
    "deathDate": "2020-08-10",
    "generationNumber": 1,
    "avatarUrl": null,
    "autoGeneratedEvents": [
      {
        "type": "death_anniversary",
        "title": "Giỗ Ông Nguyễn Văn An",
        "isLunar": true,
        "lunarMonth": 7,
        "lunarDay": 17,
        "nextOccurrence": {
          "solarDate": "2026-08-09",
          "lunarDate": "17/7/Bính Ngọ",
          "daysUntil": 114
        }
      }
    ]
  }
}
```

#### GET /api/trees/:treeId/relationship-query?from=C&to=A

**Response (200):**

```json
{
  "success": true,
  "data": {
    "fromPerson": { "id": "C", "name": "Nguyễn Minh Châu" },
    "toPerson": { "id": "A", "name": "Nguyễn Văn An" },
    "path": ["C", "B", "A"],
    "depth": 2,
    "lineageSide": "paternal",
    "relationshipLabel": {
      "vi": "ông nội",
      "en": "paternal grandfather"
    },
    "inverseLabel": {
      "vi": "cháu nội",
      "en": "grandchild"
    },
    "explanation": "Nguyễn Văn An là ông nội (họ nội 🔵) của Nguyễn Minh Châu"
  }
}
```

#### GET /api/admin/users (Admin only)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid-...",
        "email": "user@example.com",
        "fullName": "Nguyễn Văn B",
        "systemRole": "user",
        "isActive": true,
        "treeCount": 3,
        "lastLoginAt": "2026-04-15T10:00:00Z",
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "total": 1500,
      "page": 1,
      "perPage": 20,
      "totalPages": 75
    }
  }
}
```

---

## 6. Thiết Kế Service Layer

### 6.1 Bản Đồ Module

```
src/
├── modules/
│   ├── auth/                 AuthModule
│   │   ├── services/         AuthService, JwtService, TokenService
│   │   └── strategies/       JwtStrategy, LocalStrategy
│   │
│   ├── admin/                AdminModule  ← MỚI: Quản trị hệ thống
│   │   ├── controllers/      AdminUserController, AdminTreeController
│   │   │                     AdminAuditController, AdminSystemController
│   │   └── services/         AdminUserService, AdminDashboardService
│   │                         AdminAnnouncementService, HolidayService
│   │
│   ├── family-tree/          FamilyTreeModule
│   │   └── services/         FamilyTreeService, TreeSharingService
│   │
│   ├── person/               PersonModule
│   │   └── services/         PersonService, PersonSearchService
│   │
│   ├── relationship/         RelationshipModule
│   │   └── services/         RelationshipService, RelationshipEngine
│   │                         LineageSideService  ← Tính Nội/Ngoại tự động
│   │
│   ├── event/                EventModule
│   │   └── services/         EventService, RecurrenceService, LunarService
│   │                         EventAutoGeneratorService  ← Tự tạo giỗ/sinh nhật
│   │
│   ├── notification/         NotificationModule
│   │   └── services/         NotificationService, ReminderScheduler
│   │                         EmailService, PushService, InAppService
│   │                         RabbitMQPublisher
│   │
│   ├── calendar/             CalendarModule
│   │   └── services/         CalendarService, LunarCalendarService
│   │                         HolidayService
│   │
│   ├── storage/              StorageModule
│   │   └── services/         S3Service, ImageProcessingService
│   │
│   ├── search/               SearchModule
│   │   └── services/         SearchService
│   │
│   ├── story/                StoryModule
│   │   └── services/         StoryService
│   │
│   └── import-export/        ImportExportModule
│       └── services/         GedcomImportService, GedcomExportService
│
└── shared/
    ├── guards/               JwtAuthGuard, SystemRoleGuard, TreeMemberGuard
    ├── decorators/           @Roles(), @TreeRole(), @CurrentUser()
    ├── database/             Kết nối DB, migrations, seeds
    ├── cache/                Redis CacheService
    ├── queue/                RabbitMQ publisher/consumer
    └── utils/                Helpers, validators, pipes
```

### 6.2 Guards & Decorators Phân Quyền

```typescript
// Guard kiểm tra system role
@Injectable()
export class SystemRoleGuard implements CanActivate {
  // Đọc @Roles('admin') | @Roles('user') từ route metadata
  // So sánh với user.systemRole trong JWT payload
  // → 403 nếu thiếu quyền
}

// Guard kiểm tra tree role (sau SystemRoleGuard)
@Injectable()
export class TreeMemberGuard implements CanActivate {
  // Lấy treeId từ route params
  // Truy vấn tree_members: user có trong cây không?
  // Kiểm tra role đủ quyền cho action không (owner > editor > viewer)
  // → 403 nếu thiếu quyền
}

// Sử dụng trong controller:
@Controller('admin')
@UseGuards(JwtAuthGuard, SystemRoleGuard)
@Roles('admin')                          // Chỉ admin mới vào được
export class AdminUserController { ... }

@Controller('trees/:treeId/persons')
@UseGuards(JwtAuthGuard, TreeMemberGuard)
export class PersonController {
  @Post()
  @RequireTreeRole('editor')             // Cần ít nhất editor
  async create(...) { ... }

  @Get()
  @RequireTreeRole('viewer')             // Viewer cũng xem được
  async findAll(...) { ... }
}
```

### 6.3 RelationshipEngine — Thiết Kế Cốt Lõi

Engine quan hệ tính đường đi giữa 2 người dùng BFS/DFS trên đồ thị quan hệ, rồi ánh xạ sang nhãn tiếng Việt có ngữ cảnh Nội/Ngoại.

```
RelationshipEngine
├── computePath(personAId, personBId)       → UUID[]
├── classifyRelationship(path, genders, sides) → RelationshipLabel
├── buildGraphForTree(treeId)               → AdjacencyMap (cached Redis 5 phút)
├── findAncestors(personId, depth)          → Person[]  (dùng closure table)
├── findDescendants(personId, depth)        → Person[]  (dùng closure table)
├── detectCircular(newRelationship)         → boolean
└── resolveLineageSide(personId, rootId)    → 'paternal' | 'maternal' | 'self'
```

**Bảng Ánh Xạ Quan Hệ Tiếng Việt (đầy đủ Nội/Ngoại):**

| Bậc từ gốc     | Hướng          | Giới tính | Nội/Ngoại | Nhãn tiếng Việt       |
| -------------- | -------------- | --------- | --------- | --------------------- |
| 1 lên          | cha            | nam       | —         | Bố / Cha              |
| 1 lên          | mẹ             | nữ        | —         | Mẹ                    |
| 2 lên          | cha của bố     | nam       | Nội       | Ông Nội               |
| 2 lên          | mẹ của bố      | nữ        | Nội       | Bà Nội                |
| 2 lên          | cha của mẹ     | nam       | Ngoại     | Ông Ngoại             |
| 2 lên          | mẹ của mẹ      | nữ        | Ngoại     | Bà Ngoại              |
| 3 lên          | —              | nam       | Nội       | Cụ Ông Nội            |
| 3 lên          | —              | nữ        | Nội       | Cụ Bà Nội             |
| 1 xuống        | con            | nam       | —         | Con Trai              |
| 1 xuống        | con            | nữ        | —         | Con Gái               |
| 2 xuống        | —              | nam       | —         | Cháu Trai             |
| 2 xuống        | —              | nữ        | —         | Cháu Gái              |
| Cùng bậc       | cùng cha mẹ    | nam (lớn) | —         | Anh Trai              |
| Cùng bậc       | cùng cha mẹ    | nam (nhỏ) | —         | Em Trai               |
| Cùng bậc       | cùng cha mẹ    | nữ (lớn)  | —         | Chị Gái               |
| Cùng bậc       | cùng cha mẹ    | nữ (nhỏ)  | —         | Em Gái                |
| 2 lên, 1 xuống | anh trai bố    | nam       | Nội       | Bác Trai (Nội)        |
| 2 lên, 1 xuống | em trai bố     | nam       | Nội       | Chú (Nội)             |
| 2 lên, 1 xuống | em gái bố      | nữ        | Nội       | Cô (Nội)              |
| 2 lên, 1 xuống | anh/em trai mẹ | nam       | Ngoại     | Cậu (Ngoại)           |
| 2 lên, 1 xuống | chị/em gái mẹ  | nữ        | Ngoại     | Dì (Ngoại)            |
| 3 lên, 2 xuống | —              | —         | Nội       | Anh/Chị/Em Họ (Nội)   |
| 3 lên, 2 xuống | —              | —         | Ngoại     | Anh/Chị/Em Họ (Ngoại) |

### 6.4 AdminDashboardService

```
AdminDashboardService
├── getSystemStats()              → { totalUsers, activeUsers, totalTrees, ... }
├── getUserActivity(days)         → Biểu đồ đăng ký theo ngày
├── getQueueStatus()              → Trạng thái RabbitMQ queue
├── getLockUserHistory()          → Danh sách user đã bị khóa
└── getTopActiveUsers(limit)      → User hoạt động nhiều nhất
```

### 6.5 LunarCalendarService

```
LunarCalendarService
├── solarToLunar(date: Date)              → LunarDate  { day, month, year, stem, branch }
├── lunarToSolar(lunar: LunarDate, year)  → Date (lần xuất hiện tiếp theo)
├── getNextOccurrence(lunarDate, today)   → Date
├── isLunarLeapMonth(year, month)         → boolean
├── getLunarNewYear(year)                 → Date
└── formatVietnamese(lunar: LunarDate)    → string  "15 tháng 7 năm Giáp Ngọ"
```

### 6.6 ReminderScheduler (sử dụng RabbitMQ)

```
ReminderScheduler (cron: 06:00 GMT+7 hàng ngày)
├── scanUpcomingEvents(horizon: 7 ngày)   → EventOccurrence[]
│   ├── Sự kiện dương lịch: lấy từ events.event_date
│   └── Sự kiện âm lịch: dùng LunarCalendarService.lunarToSolar()
├── publishReminderMessages(events)       → Publish lên RabbitMQ exchange
│   ├── event.death_anniversary → q.gio
│   ├── event.birthday          → q.birthday
│   └── event.custom            → q.custom
└── handleDLQ()                           → Retry + alert admin nếu fail 3 lần
```

**Dòng Thời Gian Nhắc Nhở:**

```
Ngày sự kiện: ────────────────────────────────────────●
              -7 ngày    -3 ngày   -1 ngày    Ngày 0
                 ↑           ↑        ↑          ↑
             "Còn 7     "Còn 3    "Ngày     "Hôm nay
              ngày..."   ngày..."  mai..."   là ngày..."
```

---

## 7. Code Mẫu Chính

### 7.1 User Entity (kèm System Role)

```typescript
// src/modules/auth/entities/user.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { FamilyTree } from '../../family-tree/entities/family-tree.entity';

export enum SystemRole {
  ADMIN = 'admin',
  USER = 'user',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ name: 'full_name', nullable: true, length: 255 })
  fullName: string;

  @Column({ length: 10, default: 'vi' })
  locale: string;

  @Column({ length: 50, default: 'Asia/Ho_Chi_Minh' })
  timezone: string;

  @Column({ name: 'avatar_url', nullable: true, length: 500 })
  avatarUrl: string;

  // SYSTEM ROLE — Phân quyền cấp nền tảng
  @Column({
    name: 'system_role',
    type: 'varchar',
    length: 10,
    default: SystemRole.USER,
  })
  systemRole: SystemRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date;

  @OneToMany(() => FamilyTree, (tree) => tree.owner)
  trees: FamilyTree[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper
  isAdmin(): boolean {
    return this.systemRole === SystemRole.ADMIN;
  }
}
```

### 7.2 JWT Payload (kèm System Role)

```typescript
// src/modules/auth/interfaces/jwt-payload.interface.ts

export interface JwtPayload {
  sub: string; // user.id
  email: string;
  systemRole: 'admin' | 'user'; // QUAN TRỌNG: kiểm tra trong mọi guard
  iat?: number;
  exp?: number;
}

// Khi tạo token:
const payload: JwtPayload = {
  sub: user.id,
  email: user.email,
  systemRole: user.systemRole, // Luôn đưa vào token
};
```

### 7.3 SystemRoleGuard

```typescript
// src/shared/guards/system-role.guard.ts

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class SystemRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Nếu route không có @Roles() decorator → cho qua
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    // Kiểm tra tài khoản có bị khóa không
    if (!user.isActive) {
      throw new ForbiddenException('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
    }

    // Kiểm tra system role
    if (!requiredRoles.includes(user.systemRole)) {
      throw new ForbiddenException(
        `Bạn không có quyền truy cập tính năng này. Yêu cầu: ${requiredRoles.join(' hoặc ')}`,
      );
    }

    return true;
  }
}

// Decorator sử dụng:
// @Roles('admin')         → Chỉ admin
// @Roles('user', 'admin') → Cả hai (thường không cần vì user là mặc định)
```

### 7.4 TreeMemberGuard

```typescript
// src/shared/guards/tree-member.guard.ts

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TreeMember } from '../../modules/family-tree/entities/tree-member.entity';

const ROLE_HIERARCHY = { owner: 3, editor: 2, viewer: 1 };

@Injectable()
export class TreeMemberGuard implements CanActivate {
  constructor(
    @InjectRepository(TreeMember)
    private readonly treeMemberRepo: Repository<TreeMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const treeId = request.params.treeId;

    if (!treeId) return true; // Route không có treeId → bỏ qua

    // Admin hệ thống được xem metadata cây (không xem dữ liệu persons)
    if (user.systemRole === 'admin') return true;

    // Lấy tree role của user trong cây này
    const member = await this.treeMemberRepo.findOne({
      where: { treeId, userId: user.id },
    });

    if (!member) {
      // Kiểm tra cây có public không (nếu public → viewer không cần đăng nhập)
      throw new ForbiddenException('Bạn không có quyền truy cập cây gia phả này.');
    }

    // Gắn tree role vào request để controller sử dụng
    request.treeRole = member.role;

    // Lấy role yêu cầu từ route metadata
    const requiredTreeRole = Reflect.getMetadata('treeRole', context.getHandler()) ?? 'viewer';

    if (ROLE_HIERARCHY[member.role] < ROLE_HIERARCHY[requiredTreeRole]) {
      throw new ForbiddenException(
        `Yêu cầu quyền ${requiredTreeRole} trong cây này. Bạn có quyền: ${member.role}`,
      );
    }

    return true;
  }
}
```

### 7.5 TypeORM Entity — Person

```typescript
// src/modules/person/entities/person.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { FamilyTree } from '../../family-tree/entities/family-tree.entity';
import { Relationship } from '../../relationship/entities/relationship.entity';

@Entity('persons')
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tree_id' })
  @Index()
  treeId: string;

  @ManyToOne(() => FamilyTree, (tree) => tree.persons)
  tree: FamilyTree;

  @Column({ name: 'full_name', length: 500 })
  fullName: string;

  @Column({ nullable: true, length: 255 })
  nickname: string;

  @Column({ nullable: true, length: 10 })
  gender: 'male' | 'female' | 'unknown';

  // Nội/Ngoại — được tính tự động bởi LineageSideService
  @Column({ name: 'lineage_side', nullable: true, length: 10 })
  lineageSide: 'paternal' | 'maternal' | 'self' | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: Date;

  @Column({ name: 'birth_date_approx', default: false })
  birthDateApprox: boolean;

  @Column({ name: 'birth_place', nullable: true, length: 500 })
  birthPlace: string;

  @Column({ name: 'death_date', type: 'date', nullable: true })
  deathDate: Date;

  @Column({ name: 'is_alive', default: true })
  isAlive: boolean;

  @Column({ name: 'avatar_url', nullable: true, length: 500 })
  avatarUrl: string;

  @Column({ type: 'text', nullable: true })
  biography: string;

  @Column({ nullable: true, length: 255 })
  occupation: string;

  @Column({ name: 'lunar_birth_date', nullable: true, length: 20 })
  lunarBirthDate: string;

  @Column({ name: 'generation_number', type: 'int', nullable: true })
  generationNumber: number;

  @Column({ name: 'generation_name', nullable: true, length: 255 })
  generationName: string;

  @OneToMany(() => Relationship, (rel) => rel.personA)
  relationshipsAsA: Relationship[];

  @OneToMany(() => Relationship, (rel) => rel.personB)
  relationshipsAsB: Relationship[];

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date; // Soft delete
}
```

### 7.6 RabbitMQ Publisher

```typescript
// src/shared/queue/rabbitmq-publisher.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

export interface ReminderMessage {
  eventId: string;
  treeId: string;
  daysUntil: number; // 7, 3, 1, hoặc 0
  eventDate: string; // ISO date string
  eventType: 'death_anniversary' | 'birthday' | 'wedding_anniversary' | 'custom';
  personId?: string;
  personName?: string; // Tên người (để render nội dung thông báo)
  lunarDate?: string; // VD: "17/7/Bính Ngọ" (nếu là âm lịch)
}

@Injectable()
export class RabbitMQPublisherService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQPublisherService.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async onModuleInit() {
    const channel = this.amqpConnection.channel;

    // Dead Letter Exchange
    await channel.assertExchange('family.dlx', 'topic', { durable: true });
    await channel.assertQueue('q.dlq', { durable: true });
    await channel.bindQueue('q.dlq', 'family.dlx', '#');

    // Main Exchange
    await channel.assertExchange('family.events', 'topic', { durable: true });

    // Queues với DLX
    const queueOptions = { durable: true, deadLetterExchange: 'family.dlx' };
    await channel.assertQueue('q.gio', queueOptions);
    await channel.assertQueue('q.birthday', queueOptions);
    await channel.assertQueue('q.custom', queueOptions);

    // Bind routing keys
    await channel.bindQueue('q.gio', 'family.events', 'event.death_anniversary');
    await channel.bindQueue('q.birthday', 'family.events', 'event.birthday');
    await channel.bindQueue('q.custom', 'family.events', 'event.custom');

    this.logger.log('RabbitMQ exchanges và queues đã sẵn sàng');
  }

  async publishReminder(message: ReminderMessage): Promise<void> {
    const routingKey = `event.${message.eventType}`;
    await this.amqpConnection.publish('family.events', routingKey, message, {
      persistent: true, // Message bền vững sau restart
      expiration: '86400000', // Hết hạn sau 24h nếu chưa xử lý
    });
    this.logger.debug(
      `Published: ${routingKey} | event=${message.eventId} | daysUntil=${message.daysUntil}`,
    );
  }
}
```

---

## 8. Cấu Trúc Thư Mục

```
family-tree-platform/                    Monorepo (Turborepo)
│
├── apps/
│   ├── api/                             Backend NestJS
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── admin/               ← MỚI: AdminModule
│   │   │   │   │   ├── controllers/
│   │   │   │   │   │   ├── admin-user.controller.ts
│   │   │   │   │   │   ├── admin-tree.controller.ts
│   │   │   │   │   │   ├── admin-audit.controller.ts
│   │   │   │   │   │   └── admin-system.controller.ts
│   │   │   │   │   └── services/
│   │   │   │   │       ├── admin-user.service.ts
│   │   │   │   │       ├── admin-dashboard.service.ts
│   │   │   │   │       └── admin-announcement.service.ts
│   │   │   │   ├── family-tree/
│   │   │   │   ├── person/
│   │   │   │   ├── relationship/
│   │   │   │   ├── event/
│   │   │   │   ├── notification/
│   │   │   │   ├── calendar/
│   │   │   │   ├── story/
│   │   │   │   ├── storage/
│   │   │   │   ├── search/
│   │   │   │   └── import-export/
│   │   │   ├── shared/
│   │   │   │   ├── guards/
│   │   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   │   ├── system-role.guard.ts  ← MỚI
│   │   │   │   │   └── tree-member.guard.ts
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── roles.decorator.ts    ← MỚI
│   │   │   │   │   ├── tree-role.decorator.ts
│   │   │   │   │   └── current-user.decorator.ts
│   │   │   │   ├── database/
│   │   │   │   │   ├── migrations/
│   │   │   │   │   └── seeds/
│   │   │   │   │       └── admin.seed.ts     ← Seed tài khoản admin đầu tiên
│   │   │   │   ├── cache/
│   │   │   │   └── queue/
│   │   │   └── main.ts
│   │   └── test/
│   │
│   └── web/                             Frontend Next.js
│       ├── src/
│       │   ├── app/                     App Router (Next.js 14)
│       │   │   ├── (auth)/
│       │   │   │   ├── login/
│       │   │   │   └── register/
│       │   │   ├── (dashboard)/         Dành cho USER
│       │   │   │   ├── calendar/        📅 Lịch giỗ
│       │   │   │   ├── tree/            🌳 Cây gia phả
│       │   │   │   │   ├── paternal/    🔵 Nhánh họ Nội
│       │   │   │   │   └── maternal/    🟢 Nhánh họ Ngoại
│       │   │   │   ├── person/
│       │   │   │   ├── notifications/
│       │   │   │   └── settings/
│       │   │   └── (admin)/             Dành cho ADMIN ← MỚI
│       │   │       ├── dashboard/       📊 Tổng quan hệ thống
│       │   │       ├── users/           👥 Quản lý người dùng
│       │   │       ├── trees/           🌳 Quản lý cây (chỉ metadata)
│       │   │       ├── audit-logs/      📋 Nhật ký kiểm toán
│       │   │       ├── announcements/   📢 Thông báo hệ thống
│       │   │       └── holidays/        📅 Ngày lễ Việt Nam
│       │   ├── components/
│       │   │   ├── tree/
│       │   │   │   ├── FocusedTree.tsx
│       │   │   │   ├── PaternelBranch.tsx
│       │   │   │   └── MaternalBranch.tsx
│       │   │   ├── calendar/
│       │   │   │   ├── CalendarWidget.tsx
│       │   │   │   ├── MonthView.tsx
│       │   │   │   └── UpcomingEvents.tsx
│       │   │   ├── person/
│       │   │   │   ├── PersonCard.tsx
│       │   │   │   └── AddPersonWizard.tsx
│       │   │   ├── admin/              ← MỚI
│       │   │   │   ├── UserTable.tsx
│       │   │   │   ├── AuditLogTable.tsx
│       │   │   │   └── SystemStatsCard.tsx
│       │   │   └── ui/
│       │   ├── middleware/
│       │   │   └── auth.middleware.ts  ← Redirect admin→/admin, user→/dashboard
│       │   ├── hooks/
│       │   ├── store/                  Zustand state
│       │   └── lib/
│       └── package.json
│
├── packages/
│   ├── shared-types/                   TypeScript types dùng chung
│   └── lunar-calendar/                 Thư viện âm lịch Việt Nam
│
├── infrastructure/
│   ├── docker/
│   ├── k8s/
│   └── terraform/
│
└── docs/
    ├── api/                            Swagger / OpenAPI
    └── architecture/
```

---

## 9. Hệ Thống Thông Báo & Nhắc Nhở

### 9.1 Luồng Xử Lý Thông Báo

```
1. Cron job (06:00 mỗi ngày GMT+7)
   ↓
2. Quét sự kiện trong 7 ngày tới (cả dương lịch lẫn âm lịch)
   ↓
3. Tính ngày dương từ ngày âm nếu is_lunar=TRUE (LunarCalendarService)
   ↓
4. Lọc theo reminder_days của từng sự kiện (mặc định: [7, 3, 1, 0])
   ↓
5. Publish message lên RabbitMQ
   (routing key: event.death_anniversary / event.birthday / event.custom)
   ↓
6. Consumer nhận message → đọc notification_preferences của user
   ↓
7. Gửi song song theo kênh được bật:
   ├── In-app  (WebSocket real-time — mặc định BẬT)
   ├── Email   (SendGrid template — mặc định BẬT)
   └── Push    (FCM — mặc định TẮT, user tự bật)
   ↓
8. Lưu trạng thái vào bảng notifications (sent / failed)
   ↓
9. Nếu fail → vào Dead Letter Queue → retry 3 lần → alert admin
```

### 9.2 Mẫu Tin Nhắn Thông Báo

| Loại      | Trước bao lâu | Nội dung thông báo                                                           |
| --------- | ------------- | ---------------------------------------------------------------------------- |
| Ngày giỗ  | 7 ngày        | "Còn 7 ngày nữa là ngày giỗ của Ông Nguyễn Văn An (17/7 Âm lịch — 09/08)"    |
| Ngày giỗ  | 3 ngày        | "Còn 3 ngày nữa là ngày giỗ của Ông Nguyễn Văn An. Hãy chuẩn bị lễ vật."     |
| Ngày giỗ  | 1 ngày        | "Ngày mai là ngày giỗ của Ông Nguyễn Văn An. Hãy chuẩn bị lễ vật."           |
| Ngày giỗ  | Ngày diễn ra  | "Hôm nay là ngày giỗ của Ông Nguyễn Văn An. Xin hãy tưởng nhớ. 🕯️"           |
| Sinh nhật | Ngày diễn ra  | "Hôm nay là sinh nhật của Mẹ! Đừng quên chúc mừng 🎂"                        |
| Kỷ niệm   | 3 ngày        | "Còn 3 ngày nữa là kỷ niệm ngày cưới của Bố và Mẹ (35 năm) 💒"               |
| Hệ thống  | —             | (Admin gửi) "Hệ thống sẽ bảo trì lúc 2:00 ngày 20/04. Vui lòng lưu dữ liệu." |

### 9.3 Cài Đặt Thông Báo (Mặc Định)

```
✅ Ngày giỗ:    Nhắc trước 7 ngày + 3 ngày + 1 ngày + ngày diễn ra
✅ Sinh nhật:   Nhắc đúng ngày
✅ Kỷ niệm:     Nhắc trước 3 ngày + ngày diễn ra
✅ In-app:      Bật mặc định (WebSocket real-time)
✅ Email:       Bật mặc định (SendGrid)
⬜ Push:        Tắt mặc định (user tự bật, yêu cầu FCM permission)

⏰ Giờ im lặng: 22:00 – 07:00 (hoãn gửi sang 07:00 hôm sau)
```

### 9.4 Thông Báo Hệ Thống (Admin Broadcast)

Khác với thông báo sự kiện, admin có thể gửi `system_announcements` tới toàn bộ người dùng:

```
Loại thông báo:
  📢 info        → Tính năng mới, cập nhật
  ⚠️  warning    → Thay đổi chính sách, sắp bảo trì
  🔧 maintenance → Bảo trì hệ thống (kèm thời gian)

Hiển thị:
  → Banner trên top của dashboard (tất cả user thấy)
  → Tự động ẩn sau expires_at
  → User có thể dismiss (đóng) thông báo
```

---

## 10. Hỗ Trợ Lịch Âm

### 10.1 Nguyên Tắc Lưu Trữ

- **Luôn lưu dương lịch** vào cột `event_date` để dễ truy vấn và sort
- Nếu sự kiện là âm lịch (`is_lunar = TRUE`), lưu thêm `lunar_month` + `lunar_day`
- Mỗi năm, hệ thống tự tính ngày dương tương đương từ ngày âm
- Hỗ trợ **tháng nhuận** (năm âm lịch có 13 tháng): nếu năm có tháng 7 nhuận, giỗ tháng 7 diễn ra vào tháng 7 chính
- Cột `lunar_year_stem` + `lunar_year_branch` lưu Can Chi của năm gốc (VD: "Giáp", "Ngọ")

### 10.2 Ví Dụ Thực Tế

```
Ngày giỗ ông nội: 17 tháng 7 Âm lịch
→ Lưu: is_lunar=true, lunar_month=7, lunar_day=17
→ Năm 2025: dương lịch 20/08/2025
→ Năm 2026: dương lịch 09/08/2026
→ Năm 2027: dương lịch 29/08/2027
→ Hệ thống tự tính mỗi năm, không cần nhập lại
```

### 10.3 Lịch Âm Trên Giao Diện

```
Tháng 8/2026
┌────┬────┬────┬────┬────┬────┬────┐
│ CN │ T2 │ T3 │ T4 │ T5 │ T6 │ T7 │
├────┼────┼────┼────┼────┼────┼────┤
│    │    │    │    │    │    │  1 │
│    │    │    │    │    │    │ 8/7│   ← số nhỏ = ngày âm lịch
├────┼────┼────┼────┼────┼────┼────┤
│  9 │ 10 │... │    │    │    │    │
│17/7│    │    │    │    │    │    │   ← 17/7: ngày giỗ (highlight 🔴)
└────┴────┴────┴────┴────┴────┴────┘

Chú thích màu sắc trên lịch:
🔴 Ngày giỗ (death_anniversary)
🟡 Sinh nhật (birthday)
💜 Kỷ niệm (wedding_anniversary)
🟢 Ngày lễ quốc gia (holiday/tet — do admin quản lý)
```

---

## 11. Kiến Trúc Frontend & UX

### 11.1 Phân Quyền Routing Frontend

```
Sau khi đăng nhập:
├── systemRole = 'admin'  → Redirect đến /admin/dashboard
└── systemRole = 'user'   → Redirect đến /dashboard

Middleware bảo vệ route:
├── /admin/*     → Yêu cầu systemRole = 'admin'
│                → Nếu là 'user': redirect về /dashboard với toast "Không có quyền"
├── /dashboard/* → Yêu cầu đăng nhập (bất kỳ role)
│                → Nếu chưa đăng nhập: redirect về /login
└── /            → Landing page (public, không cần đăng nhập)
```

### 11.2 Giao Diện Admin Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  👑 Admin Dashboard          [admin@familytree.app]  [Logout]│
├──────────┬──────────────────────────────────────────────────┤
│          │  📊 Tổng Quan Hệ Thống                            │
│ 📊 Dash  │  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ 👥 Users │  │ 1,532    │ │  287     │ │  12,450  │         │
│ 🌳 Trees │  │ Người    │ │  Cây     │ │  Sự kiện │         │
│ 📋 Logs  │  │ dùng     │ │ gia phả  │ │  giỗ/SN  │         │
│ 📢 Thông │  └──────────┘ └──────────┘ └──────────┘         │
│    báo   │                                                   │
│ 📅 Ngày  │  👥 Người Dùng Mới (7 ngày qua)                  │
│    lễ    │  [Biểu đồ cột theo ngày]                         │
│ ⚙️  System│                                                   │
│          │  ⚠️  Dead Letter Queue: 3 messages cần xử lý      │
│          │  [Xem chi tiết →]                                 │
└──────────┴──────────────────────────────────────────────────┘
```

### 11.3 Giao Diện Quản Lý Người Dùng (Admin)

```
┌─────────────────────────────────────────────────────────────┐
│ 👥 Quản Lý Người Dùng         [+ Tạo admin mới]             │
│                                                              │
│ Tìm kiếm: [____________________] Lọc: [Tất cả ▼] [Vai trò▼]│
├───────────────────┬──────────┬────────┬───────────┬─────────┤
│ Tên / Email       │ Vai trò  │ Trạng  │ Đăng nhập │ Hành    │
│                   │ HT       │ thái   │ gần nhất  │ động    │
├───────────────────┼──────────┼────────┼───────────┼─────────┤
│ Nguyễn Văn B      │ 👤 user  │ ✅ OK  │ 2 giờ trước│ [···]  │
│ nguyen.b@...      │          │        │           │         │
├───────────────────┼──────────┼────────┼───────────┼─────────┤
│ Trần Thị C        │ 👤 user  │ 🔒 Khóa│ 5 ngày    │ [···]  │
│ tran.c@...        │          │        │           │         │
├───────────────────┼──────────┼────────┼───────────┼─────────┤
│ Lê Văn D          │ 👑 admin │ ✅ OK  │ 1 ngày    │ [···]  │
│ le.d@...          │          │        │           │         │
└───────────────────┴──────────┴────────┴───────────┴─────────┘

Menu [···]:
  → Xem chi tiết
  → Khóa / Mở khóa tài khoản
  → Cấp / Thu hồi quyền Admin
  → Xem lịch sử hoạt động
  → Xóa tài khoản
```

### 11.4 Luồng Nhập Liệu Từng Bước (Wizard — User)

```
Bước 1: Tạo hồ sơ bản thân
┌─────────────────────────────┐
│ Tên của bạn là gì?          │
│ [Nguyễn Văn B            ]  │
│                             │
│ Ngày sinh (tùy chọn)        │
│ [                        ]  │
│                             │
│         [Bắt đầu →]         │
└─────────────────────────────┘

Bước 2: Gợi ý thêm người thân
┌─────────────────────────────┐
│ Bạn muốn thêm ai tiếp theo? │
│                             │
│  [👨 Thêm Bố]  [👩 Thêm Mẹ]│
│  [💑 Thêm Vợ/Chồng]         │
│  [👶 Thêm Con]              │
│                             │
│         [Bỏ qua →]          │
└─────────────────────────────┘

Bước 3: Sau khi thêm bố → gợi ý tiếp
┌─────────────────────────────┐
│ Muốn thêm bố mẹ của Bố      │
│ (Ông Nội, Bà Nội)?          │
│                             │
│   [Thêm]     [Bỏ qua]       │
└─────────────────────────────┘
```

### 11.5 Cây Gia Phả (Focused Tree)

```
           🔵 Ông Nội    🔵 Bà Nội
                  │
           🔵 Bố ────── 🔵 Mẹ ──────── 🟢 Ông Ngoại  🟢 Bà Ngoại
                  │
               👤 BẠN
              /        \
      👤 Con 1      👤 Con 2
```

- **🔵 Xanh dương** = Họ Nội (paternal)
- **🟢 Xanh lá** = Họ Ngoại (maternal)
- **Click vào bất kỳ ai** → Cây tái căn giữa vào người đó
- Chỉ hiển thị **3 thế hệ** xung quanh người được chọn (không quá tải)
- Nút chuyển đổi: `[Toàn bộ] [Họ Nội 🔵] [Họ Ngoại 🟢]`

### 11.6 Thẻ Người (Person Card)

```
┌─────────────────────────────┐
│ 👨  Nguyễn Văn An           │
│     Ông Nội (Họ Nội) 🔵     │  ← Quan hệ tự động sinh ra
│                             │
│ 📅 Sinh: 15/03/1950         │
│ 📅 Mất:  10/08/2020         │
│ 🕯️ Giỗ:  17/7 Âm (09/08/2026)│ ← Hiển thị cả âm + dương + năm
│                             │
│ 📍 Hà Nội                   │
│ 💼 Giáo viên                │
│                             │
│ [Xem chi tiết] [Chỉnh sửa] │
└─────────────────────────────┘
```

### 11.7 Widget Lịch Giỗ (Dashboard User)

```
📅 Sự Kiện Sắp Tới
──────────────────────────────
🕯️ Hôm nay  — Giỗ Bà Nội Trần Thị B (họ ngoại 🟢)
🎂 3 ngày   — Sinh nhật Mẹ (60 tuổi)
🕯️ 7 ngày   — Giỗ Ông Nội Nguyễn Văn An (họ nội 🔵)
💒 15 ngày  — Kỷ niệm cưới Bố Mẹ (35 năm)
──────────────────────────────
[Xem lịch đầy đủ →]
```

### 11.8 Tính Năng "Hỏi Quan Hệ"

```
Ô tìm kiếm: "Nguyễn Thị C là gì của tôi?"
         ↓
Kết quả ngay lập tức:
┌─────────────────────────────────┐
│ Nguyễn Thị C                    │
│ là CÔ RUỘT (Họ Nội) 🔵          │
│                                 │
│ Em gái của Bố → Cô              │
│ (2 bậc quan hệ)                 │
└─────────────────────────────────┘
```

### 11.9 Thiết Kế Màu Sắc & Biểu Tượng

```
Màu sắc theo thế hệ (trên node cây):
  Thế hệ 1 (gốc): #1A1A2E (đen đậm)
  Thế hệ 2:       #16213E (xanh đậm)
  Thế hệ 3:       #0F3460 (xanh vừa)
  Thế hệ 4:       #533483 (tím)
  Thế hệ 5+:      #E94560 (đỏ nhạt)

Màu nhánh:
  Họ Nội:   #3B82F6 (xanh dương)  🔵
  Họ Ngoại: #10B981 (xanh lá)     🟢
  Hôn nhân: #8B5CF6 (tím)         (dashed line)

Đường nối:
  ─────────  Huyết thống (solid)
  - - - - -  Hôn nhân / con nuôi (dashed)

Biểu tượng trên node:
  👨 Nam    👩 Nữ    👤 Không rõ
  ✝️  Đã mất  🌱 Còn sống

Biểu tượng sự kiện:
  🕯️ Ngày giỗ    🎂 Sinh nhật    💒 Kỷ niệm    🎉 Tùy chỉnh
```

---

## 12. Bảo Mật & Phân Quyền Chi Tiết

### 12.1 Xác Thực JWT (Hai Token)

```
Access Token:   15 phút  — Lưu trong memory (không lưu localStorage)
Refresh Token:  30 ngày  — httpOnly cookie (chống XSS)

Payload JWT:
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "systemRole": "admin" | "user",   ← QUAN TRỌNG
  "iat": 1713340800,
  "exp": 1713341700
}

Luồng làm mới token:
1. Access token hết hạn → frontend tự động gọi POST /api/auth/refresh
2. Backend xác minh refresh token trong DB (kiểm tra không bị revoke)
3. Phát hành access token mới (15 phút)
4. Nếu refresh token cũng hết hạn → 401 → đăng xuất, yêu cầu đăng nhập lại
```

### 12.2 Ma Trận Phân Quyền Đầy Đủ

| Tính năng / Endpoint         | Admin | User (owner) | User (editor) | User (viewer) | Chưa đăng nhập |
| ---------------------------- | ----- | ------------ | ------------- | ------------- | -------------- |
| Đăng ký / Đăng nhập          | ✅    | ✅           | ✅            | ✅            | ✅             |
| Xem hồ sơ cá nhân            | ✅    | ✅           | ✅            | ✅            | ❌             |
| Tạo cây gia phả mới          | ✅    | ✅           | ❌            | ❌            | ❌             |
| Xem cây (public)             | ✅    | ✅           | ✅            | ✅            | ✅             |
| Xem cây (private)            | ✅\*  | ✅           | ✅            | ✅            | ❌             |
| Thêm/sửa persons & events    | ✅\*  | ✅           | ✅            | ❌            | ❌             |
| Xóa persons                  | ✅\*  | ✅           | ✅            | ❌            | ❌             |
| Chia sẻ cây (mời thành viên) | ❌    | ✅           | ❌            | ❌            | ❌             |
| Xóa cây                      | ✅    | ✅           | ❌            | ❌            | ❌             |
| Import/Export GEDCOM         | ✅\*  | ✅           | ✅            | ❌            | ❌             |
| Xem danh sách tất cả users   | ✅    | ❌           | ❌            | ❌            | ❌             |
| Khóa/mở khóa tài khoản       | ✅    | ❌           | ❌            | ❌            | ❌             |
| Cấp/thu hồi quyền admin      | ✅    | ❌           | ❌            | ❌            | ❌             |
| Xem audit logs               | ✅    | ❌           | ❌            | ❌            | ❌             |
| Gửi thông báo broadcast      | ✅    | ❌           | ❌            | ❌            | ❌             |
| Quản lý ngày lễ Việt Nam     | ✅    | ❌           | ❌            | ❌            | ❌             |
| Xem system stats & queue     | ✅    | ❌           | ❌            | ❌            | ❌             |

> `✅*` = Admin chỉ thực hiện khi điều tra vi phạm có ghi audit log đặc biệt.

### 12.3 Bảo Mật Bổ Sung

```
Rate Limiting:
  /api/auth/login          → 5 request/phút/IP (chống brute force)
  /api/auth/forgot-password → 3 request/giờ/IP
  /api/*                   → 100 request/phút/user
  /api/admin/*             → 200 request/phút/admin

Validation:
  Tất cả DTO đều dùng class-validator
  Sanitize HTML trong biography, story content (chống XSS)
  Validate file upload: chỉ jpg/png/pdf/mp3, tối đa 10MB

Dữ liệu nhạy cảm:
  Password: bcrypt, salt rounds = 12
  Refresh token: lưu dưới dạng SHA-256 hash (không lưu raw)
  Cây private: hoàn toàn cô lập — không thể truy cập chéo

Audit:
  Mọi thao tác quan trọng (create/update/delete/share/login/lock) đều ghi audit_logs
  Admin action trên data của user → ghi thêm tag "admin_override"
```

---

## 13. Chiến Lược Mở Rộng

### 13.1 Caching với Redis

```
Cache Layer (Redis TTL):
├── tree-graph:{treeId}              → 5 phút   (graph D3.js, invalidate khi có thay đổi)
├── relationship:{fromId}:{toId}     → 1 giờ    (kết quả tra cứu quan hệ)
├── upcoming-events:{treeId}         → 1 giờ    (sự kiện sắp tới dashboard)
├── person:{personId}                → 30 phút  (thông tin cá nhân)
├── session:{userId}                 → 15 phút  (phiên đăng nhập)
├── admin:dashboard:stats            → 5 phút   (thống kê admin)
└── announcements:active             → 10 phút  (thông báo hệ thống đang active)
```

### 13.2 Tối Ưu Database

```sql
-- Composite indexes cho truy vấn phổ biến
CREATE INDEX idx_events_upcoming ON events(tree_id, event_date, event_type)
    WHERE is_recurring = TRUE;

CREATE INDEX idx_persons_search ON persons
    USING GIN(to_tsvector('simple', full_name || ' ' || COALESCE(nickname, '')));

-- Partial index cho sự kiện âm lịch
CREATE INDEX idx_events_lunar_recurring ON events(lunar_month, lunar_day)
    WHERE is_lunar = TRUE AND is_recurring = TRUE;

-- Index cho admin queries
CREATE INDEX idx_users_role_active ON users(system_role, is_active, created_at DESC);
CREATE INDEX idx_audit_recent ON audit_logs(created_at DESC) WHERE created_at > NOW() - INTERVAL '90 days';
```

### 13.3 Horizontal Scaling

```
Load Balancer (Nginx)
    ↓
API Instances (nhiều pod, stateless — JWT không cần sticky session)
    ↓
PostgreSQL (Primary + 1 Read Replica — admin queries dùng replica)
Redis Cluster  (Cache + Session)
RabbitMQ Cluster (Message Queue — HA mode)
S3 (File Storage — không scale vấn đề)
```

---

## 14. Tính Năng Nâng Cao

### 14.1 Import/Export GEDCOM

- **Import**: Hỗ trợ GEDCOM 5.5.1, tự động tạo persons + relationships + events. Phát hiện bản ghi trùng lặp, báo lỗi rõ ràng
- **Export**: Xuất toàn bộ cây sang GEDCOM, tương thích với Ancestry.com, FamilySearch, MacFamilyTree
- **Quyền**: Chỉ owner và editor mới được import/export

### 14.2 Phát Hiện Xung Đột Logic

```
Các lỗi được tự động phát hiện khi thêm/sửa quan hệ:
❌ Con sinh trước cha mẹ
❌ Người chết trước khi sinh
❌ Vòng tròn quan hệ (A là cha B là cha A)
❌ Quá nhiều cha ruột hoặc mẹ ruột (>2)
❌ Kết hôn với người có quan hệ huyết thống gần (cảnh báo)
⚠️  Ngày sinh ước tính (birth_date_approx = true) — hiển thị dấu "~"
```

### 14.3 Thống Kê & Insight

```
📊 Thống kê cây gia phả (tính real-time từ closure table):
   Tổng thành viên:     247
   Đang sống:           189  |  Đã mất: 58
   Số thế hệ:           6
   Người sống lâu nhất: 94 tuổi
   Tuổi thọ trung bình: 72.3 tuổi

📅 Sự kiện (30 ngày tới):
   8 sinh nhật  |  3 ngày giỗ  |  1 kỷ niệm cưới

🗺️ Phân bổ địa lý:
   Hà Nội: 142  |  TP.HCM: 67  |  Đà Nẵng: 23  |  Hải ngoại: 15
```

### 14.4 Sách Ký Ức Gia Đình

- Upload ảnh cũ kèm ngày tháng và địa điểm
- Gắn thẻ nhiều người trong cùng một kỷ niệm
- Chia sẻ ký ức với các cộng tác viên có quyền editor+
- Xuất thành "Sách Gia Đình" định dạng PDF (Giai đoạn 4)

### 14.5 Tìm Kiếm Thông Minh

```
Tìm kiếm toàn văn: "Nguyễn + Hà Nội + giáo viên"
→ Kết quả: Tất cả người họ Nguyễn, ở Hà Nội, nghề giáo viên

Tìm kiếm quan hệ: "Tìm tất cả cháu nội của Ông Nguyễn Văn A"
→ Kết quả: Danh sách cháu theo thế hệ (dùng closure table)

Lọc kết hợp: Giới tính / Thế hệ / Nội-Ngoại / Còn sống / Đã mất / Năm sinh
```

---

## 15. DevOps & Hạ Tầng

### 15.1 Docker Compose (Môi Trường Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: ./apps/api
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/family_tree
      REDIS_URL: redis://redis:6379
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
      JWT_SECRET: your-secret-key-min-32-chars
      INITIAL_ADMIN_EMAIL: admin@familytree.app
      INITIAL_ADMIN_PASSWORD: AdminPass@2026
    depends_on:
      - db
      - redis
      - rabbitmq
    volumes:
      - ./apps/api/src:/app/src

  web:
    build: ./apps/web
    ports:
      - '3001:3001'
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3000
    volumes:
      - ./apps/web/src:/app/src

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: family_tree
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - '5432:5432'

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    ports:
      - '5672:5672' # AMQP
      - '15672:15672' # Management UI: http://localhost:15672
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

  mailhog:
    image: mailhog/mailhog
    ports:
      - '1025:1025' # SMTP
      - '8025:8025' # Web UI xem email test

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
```

### 15.2 Biến Môi Trường

```bash
# .env.example

# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/family_tree
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_EXCHANGE=family.events
RABBITMQ_DLX=family.dlx

# JWT
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=30d

# Admin mặc định (seed khi khởi tạo)
INITIAL_ADMIN_EMAIL=admin@familytree.app
INITIAL_ADMIN_PASSWORD=AdminPass@2026

# Storage (S3)
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=family-tree-assets

# Email (SendGrid)
SENDGRID_API_KEY=SG.xxxxxxxx
FROM_EMAIL=noreply@familytree.app
FROM_NAME=Gia Phả Việt

# Push Notifications (FCM)
FCM_SERVER_KEY=your-fcm-key

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
THROTTLE_ADMIN_LIMIT=200
```

### 15.3 Database Seed — Admin Đầu Tiên

```typescript
// src/shared/database/seeds/admin.seed.ts
// Chạy khi khởi tạo môi trường mới

import * as bcrypt from 'bcrypt';

export async function seedInitialAdmin(dataSource) {
  const adminRepo = dataSource.getRepository('users');
  const existing = await adminRepo.findOne({ where: { email: process.env.INITIAL_ADMIN_EMAIL } });

  if (!existing) {
    await adminRepo.save({
      email: process.env.INITIAL_ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, 12),
      fullName: 'System Administrator',
      systemRole: 'admin', // ← Gán admin role
      isActive: true,
    });
    console.log('✅ Tài khoản admin đầu tiên đã được tạo');
  }
}
```

### 15.4 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Chạy tests
        run: |
          npm ci
          npm run test:coverage
          npm run lint

  security-scan:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Kiểm tra dependencies lỗ hổng
        run: npm audit --audit-level=high

  build-and-deploy:
    needs: security-scan
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker images
        run: docker-compose -f docker-compose.prod.yml build
      - name: Push lên ECR
        run: aws ecr push ...
      - name: Deploy lên ECS / K8s
        run: kubectl apply -f infrastructure/k8s/
      - name: Chạy DB migrations
        run: kubectl exec deploy/api -- npm run migration:run
```

---

## 16. Lộ Trình Tính Năng

### Giai Đoạn 1 — MVP (Tháng 1–3)

| Tính năng                                          | Ưu tiên |
| -------------------------------------------------- | ------- |
| Xác thực người dùng (đăng ký / đăng nhập / JWT)    | 🔴 P0   |
| **Phân quyền System Role (admin / user)**          | 🔴 P0   |
| **Phân quyền Tree Role (owner / editor / viewer)** | 🔴 P0   |
| **Seed tài khoản admin đầu tiên**                  | 🔴 P0   |
| **SystemRoleGuard + TreeMemberGuard**              | 🔴 P0   |
| Tạo và quản lý cây gia phả                         | 🔴 P0   |
| Thêm / sửa / xóa thành viên gia đình               | 🔴 P0   |
| Thêm quan hệ cha-con và vợ chồng                   | 🔴 P0   |
| Phân nhánh Nội / Ngoại tự động                     | 🔴 P0   |
| Hiển thị cây tập trung (Focused Tree) với D3.js    | 🔴 P0   |
| Sự kiện giỗ và sinh nhật tự động tạo từ thành viên | 🔴 P0   |
| Nhắc nhở 7/3/1/0 ngày qua RabbitMQ                 | 🔴 P0   |
| Thông báo in-app (WebSocket)                       | 🔴 P0   |
| Widget lịch trên dashboard người dùng              | 🔴 P0   |
| **Admin Dashboard cơ bản (stats + user list)**     | 🟡 P1   |
| Upload ảnh đại diện (S3)                           | 🟡 P1   |
| Audit log cơ bản (login / create / delete)         | 🟡 P1   |

### Giai Đoạn 2 — Core (Tháng 4–6)

| Tính năng                                           | Ưu tiên |
| --------------------------------------------------- | ------- |
| Hỗ trợ lịch âm đầy đủ (tháng nhuận, Can Chi)        | 🔴 P0   |
| Tính ngày giỗ âm lịch chính xác mỗi năm             | 🔴 P0   |
| **Quản lý người dùng cho admin (khóa/mở/cấp role)** | 🔴 P0   |
| **Audit log đầy đủ (mọi action quan trọng)**        | 🔴 P0   |
| Thông báo qua email (SendGrid template tiếng Việt)  | 🟡 P1   |
| Engine tra cứu quan hệ ("A là gì của tôi?")         | 🟡 P1   |
| Tìm kiếm toàn văn (tên + nghề + địa điểm)           | 🟡 P1   |
| Chia sẻ cây (mời cộng tác viên qua email)           | 🟡 P1   |
| Dòng thời gian cuộc đời của mỗi người               | 🟡 P1   |
| Thư viện ảnh của mỗi thành viên                     | 🟡 P1   |
| Phát hiện xung đột logic quan hệ                    | 🟡 P1   |
| **Thông báo hệ thống (admin broadcast)**            | 🟡 P1   |

### Giai Đoạn 3 — Nâng Cao (Tháng 7–9)

| Tính năng                                            | Ưu tiên |
| ---------------------------------------------------- | ------- |
| Import/Export GEDCOM                                 | 🟡 P1   |
| Ký ức gia đình (câu chuyện + ảnh cũ + gắn thẻ người) | 🟢 P2   |
| Thống kê & insight cây gia phả                       | 🟢 P2   |
| Push notification (FCM)                              | 🟢 P2   |
| **Quản lý ngày lễ Việt Nam (admin)**                 | 🟢 P2   |
| **Xem system queue status (admin)**                  | 🟢 P2   |
| Cài đặt riêng tư cây (công khai/riêng tư)            | 🟢 P2   |
| Lịch ngày lễ Việt Nam tự động                        | 🟢 P2   |
| PWA (hỗ trợ offline cơ bản)                          | 🟢 P2   |

### Giai Đoạn 4 — Mở Rộng (Tháng 10–12)

| Tính năng                                     | Ưu tiên |
| --------------------------------------------- | ------- |
| Đa ngôn ngữ (Tiếng Việt / Tiếng Anh)          | 🟢 P2   |
| Xuất Sách Gia Đình định dạng PDF              | 🟢 P2   |
| Bản đồ địa lý phân bổ thành viên              | 🟢 P2   |
| API cho tích hợp bên thứ ba                   | 🔵 P3   |
| Ứng dụng mobile native (React Native)         | 🔵 P3   |
| **Two-factor authentication (2FA) cho admin** | 🔵 P3   |
| **SSO / OAuth (Google, Facebook)**            | 🔵 P3   |

---

## 📌 Tóm Tắt Quyết Định Kỹ Thuật

| Hạng mục            | Quyết định                                            | Lý do                                                      |
| ------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| **Backend**         | NestJS + TypeORM + PostgreSQL                         | Có cấu trúc, dễ mở rộng, hỗ trợ DDD                        |
| **Phân quyền**      | **2 tầng: System Role + Tree Role**                   | Admin quản lý platform, Tree Role quản lý từng cây độc lập |
| **System Roles**    | **`admin` & `user`** (lưu trong `users.system_role`)  | Rõ ràng, dễ kiểm tra, đưa vào JWT payload                  |
| **Tree Roles**      | **`owner`, `editor`, `viewer`** (bảng `tree_members`) | Phân quyền chi tiết theo từng cây, hỗ trợ cộng tác         |
| **Guards**          | JwtAuthGuard → SystemRoleGuard → TreeMemberGuard      | Kiểm tra tuần tự, rõ luồng                                 |
| **Lưu trữ quan hệ** | Adjacency list + Closure table                        | Tối ưu cho truy vấn tổ tiên/con cháu O(1)                  |
| **Message Queue**   | **RabbitMQ** (thay BullMQ)                            | Routing linh hoạt, DLQ, fan-out, độc lập Redis             |
| **Cache**           | Redis                                                 | Session + tree graph + upcoming events + admin stats       |
| **File Storage**    | AWS S3                                                | Ảnh đại diện, tài liệu, ký ức                              |
| **Email**           | SendGrid (template Handlebars)                        | Gửi nhắc nhở giỗ/sinh nhật tiếng Việt, có template         |
| **Scheduler**       | @nestjs/schedule (Cron) → RabbitMQ                    | Scan hàng ngày 06:00, publish messages                     |
| **Frontend**        | Next.js 14 (App Router) + Tailwind                    | SSR, SEO, route groups (admin) vs (dashboard)              |
| **Hiển thị cây**    | D3.js (custom focused tree)                           | Tùy biến tốt, center-based view, Nội/Ngoại 2 màu           |
| **Lịch**            | FullCalendar.js + âm lịch tùy chỉnh                   | Hiển thị song song dương + âm lịch                         |
| **Xác thực**        | JWT (15 phút) + Refresh Token (httpOnly cookie)       | Bảo mật, chống XSS                                         |
| **Thông báo**       | In-app (WebSocket) + Email + Push (tương lai)         | Đa kênh, mặc định bật in-app + email                       |
| **Lịch nhắc nhở**   | **7 ngày / 3 ngày / 1 ngày / Ngày diễn ra**           | Đủ thời gian chuẩn bị lễ vật giỗ                           |
| **Âm lịch**         | Thuật toán Việt Nam (Can Chi, tháng nhuận)            | Chính xác cho ngày giỗ lịch âm                             |
| **Audit**           | Bảng `audit_logs` toàn diện                           | Admin theo dõi mọi thay đổi                                |
| **Triển khai**      | Docker + Kubernetes (EKS hoặc GKE)                    | Scale theo nhu cầu, zero-downtime deploy                   |

---

> **Triết lý thiết kế:**
>
> - **Với người dùng:** Chỉ cảm thấy "Tôi đang thêm người thân vào gia đình" — không phải "Tôi đang xây dựng một hệ thống phức tạp." Bà nội 70 tuổi cũng dùng được.
> - **Với admin:** Có đầy đủ công cụ để quản lý nền tảng mà không xâm phạm quyền riêng tư dữ liệu gia phả của người dùng.
> - **Với team kỹ thuật:** Mọi tính năng đều có API rõ ràng, guard đúng chỗ, audit log đầy đủ — sẵn sàng triển khai từng phase một cách có hệ thống.

_Phiên bản 3.0.0 — Tài liệu này được thiết kế cho hệ thống sản xuất thực tế, tích hợp đầy đủ phân quyền hai tầng Admin/User._
