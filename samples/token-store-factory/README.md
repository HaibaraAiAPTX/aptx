# TokenStore 工厂函数示例

本示例演示 `@aptx/api-plugin-auth` 的 `store` 选项如何支持工厂函数，以兼容浏览器端和 SSR 环境。

## 背景

`createAuthMiddleware` 和 `createAuthController` 的 `store` 选项现在支持三种形式：

```typescript
type TokenStoreResolver =
  | TokenStore              // 直接实例（向后兼容）
  | (() => TokenStore)      // 同步工厂函数
  | (() => Promise<TokenStore>); // 异步工厂函数
```

## 浏览器端用法

浏览器端使用 `CookieTokenStore`，通常创建单例实例：

```typescript
import { createAuthMiddleware } from "@aptx/api-plugin-auth";
import { CookieTokenStore } from "@aptx/token-store-cookie";

// 方式 1：直接传实例（向后兼容）
const store = new CookieTokenStore({ tokenKey: "auth_token" });
const middleware = createAuthMiddleware({ store, ... });

// 方式 2：工厂函数（推荐，保持 API 一致性）
const middleware = createAuthMiddleware({
  store: () => store,
  ...
});
```

## SSR 端用法

SSR 环境需要为每个请求创建独立的 store，因为 cookie 需要从请求上下文读取：

### Next.js App Router

```typescript
import { cookies } from "next/headers";
import { createAuthMiddleware } from "@aptx/api-plugin-auth";
import { SsrCookieTokenStore } from "@aptx/token-store-ssr-cookie";

// 异步工厂函数，每次调用返回新实例
const middleware = createAuthMiddleware({
  store: async () => {
    const cookieStore = await cookies(); // Next.js 15+ 的异步 API
    return new SsrCookieTokenStore({
      tokenKey: "auth_token",
      getCookieHeader: () => cookieStore.toString(),
      setCookie: (v) => { /* 解析并设置 */ },
    });
  },
  ...
});
```

### Next.js Pages Router

```typescript
import { createAuthMiddleware } from "@aptx/api-plugin-auth";
import { SsrCookieTokenStore } from "@aptx/token-store-ssr-cookie";

export function createRequestAuthMiddleware(ctx: GetServerSidePropsContext) {
  return createAuthMiddleware({
    store: () => new SsrCookieTokenStore({
      getCookieHeader: () => ctx.req.headers.cookie ?? "",
      setCookie: (v) => ctx.res.setHeader("Set-Cookie", v),
    }),
    ...
  });
}
```

## 并发安全

| 场景 | 隔离机制 |
|------|---------|
| 浏览器多请求并发 | `refreshPromise` 锁，避免重复刷新 |
| SSR 多用户并发 | 每请求独立 store 实例，天然隔离 |

## 运行测试

```bash
pnpm install
pnpm test
```
