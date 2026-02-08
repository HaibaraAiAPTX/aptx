# @aptx/token-store-cookie

Cookie-based `TokenStore` implementation for aptx.

## Install

```bash
pnpm add @aptx/token-store-cookie
```

## Usage

```ts
import { createCookieTokenStore } from "@aptx/token-store-cookie";

const store = createCookieTokenStore({
  tokenKey: "token",
  metaKey: "token_meta",
  syncExpiryFromMeta: true,
  cookie: {
    path: "/",
    sameSite: "lax",
    secure: true,
  },
});

store.setToken("jwt-token", { expiresAt: Date.now() + 30 * 60 * 1000 });
```

## Notes

- When `syncExpiryFromMeta` is `true` (default), `meta.expiresAt` is mapped to cookie `expires`.
- Set `syncExpiryFromMeta: false` if you want to control cookie expiry only via `cookie` options.
