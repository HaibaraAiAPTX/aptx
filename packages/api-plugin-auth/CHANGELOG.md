# @aptx/api-plugin-auth

## 0.1.6

### Patch Changes

- Updated dependencies
  - @aptx/api-core@0.1.4

## 0.1.5

### Patch Changes

- Updated dependencies
  - @aptx/api-core@0.1.3

## 0.1.4

### Patch Changes

- 新增 `SKIP_AUTH_REFRESH_META_KEY` 导出，支持在请求 meta 中标记跳过 auth 刷新
- 修复 refreshToken 请求返回 401 时可能导致死锁的问题

### SSR Behavior

服务端环境下 (`typeof window === "undefined"`):

- `ensureValidToken` 直接返回当前 token，不执行自动刷新
- 这避免了 SSR 场景下的 token 刷新竞态条件，保持服务端无状态

## 0.1.3

### Patch Changes

- 修复了刷新 token 时 401 陷入死循环的bug，修改为服务端不执行刷新 token

## 0.1.2

### Patch Changes

- 为 auth 添加 TokenStore 工厂
- Updated dependencies
  - @aptx/api-core@0.1.2
  - @aptx/token-store@0.1.1

## 0.1.1

### Patch Changes

- Updated dependencies
  - @aptx/api-core@0.1.1
