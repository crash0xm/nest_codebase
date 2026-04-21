# Guard Strategy (Global-First)

This codebase applies authentication/authorization globally to keep security rules consistent.

## Active global guard order

1. `CustomThrottlerGuard` (rate limit)
2. `AuthGuard` (JWT auth + token blacklist)
3. `AuthorizationGuard` (roles and permissions)

## How to expose an endpoint

- Use `@Public()` for routes that do not require authentication (for example login/refresh).
- Do not attach per-controller JWT guards. Authentication is already global.

## How to protect by role

- Use `@Roles(...)` on controller handlers (or class) when role constraints are needed.
- `AuthorizationGuard` resolves role metadata and denies by default when role conditions are not met.

## How to protect by permission

- Use `@Permissions("resource:action")` on handlers (or class).
- For `own`-condition permissions, ownership is validated asynchronously through `ResourceOwnershipService`.
- Unknown permission conditions are denied by default.

## Ownership policy notes

- User ownership: user can access only their own user resource (`user.id === :id`).
- Product ownership: current schema has no product owner field, so `product:*:own` checks are denied.
  - To enable product ownership checks, add ownership fields (for example `ownerId`) and update `ResourceOwnershipService`.

## Team rules

- Prefer metadata decorators (`@Public`, `@Roles`, `@Permissions`) over custom guard wiring per route.
- If a new module needs special authorization rules, extend `ResourceOwnershipService` instead of adding placeholder logic in guards.
- Keep one source of truth for auth behavior in global guards; avoid duplicate route-level guard stacks.
