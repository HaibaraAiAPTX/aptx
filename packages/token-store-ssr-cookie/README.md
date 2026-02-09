# @aptx/token-store-ssr-cookie

`@aptx/token-store-ssr-cookie` 提供 SSR/Node 环境下的 `TokenStore` Cookie 实现，适合与 `@aptx/api-plugin-auth` 配合使用。

## Install

```bash
pnpm add @aptx/token-store-ssr-cookie @aptx/token-store
```

## Quick Start

```ts
import { createSsrCookieTokenStore } from "@aptx/token-store-ssr-cookie";

const store = createSsrCookieTokenStore({
  tokenKey: "aptx_access_token",
  metaKey: "aptx_access_meta",
  cookie: { path: "/", sameSite: "lax", httpOnly: true, secure: false },
  getCookieHeader: () => req.headers.cookie,
  setCookie: (value) => res.appendHeader("Set-Cookie", value)
});

await store.setToken("token", { expiresAt: Date.now() + 60 * 60 * 1000 });
```

## Notes

- 需自行提供请求级 `getCookieHeader` 与响应级 `setCookie`。
- `syncExpiryFromMeta` 默认 `true`，会把 `meta.expiresAt` 同步到 Cookie `Expires`。
- 默认 key：
  - `tokenKey = aptx_token`
  - `metaKey = aptx_token_meta`

## Test

```bash
pnpm --filter @aptx/token-store-ssr-cookie test
```
