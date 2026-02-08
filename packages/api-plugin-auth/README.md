# @aptx/api-plugin-auth

Auth middleware for `@aptx/api-core` with proactive and reactive refresh.

## Install

```bash
pnpm add @aptx/api-plugin-auth
```

## Usage

```ts
import { RequestClient } from "@aptx/api-core";
import { createAuthMiddleware } from "@aptx/api-plugin-auth";
import { createCookieTokenStore } from "@aptx/token-store-cookie";

const client = new RequestClient();
const store = createCookieTokenStore({
  tokenKey: "token",
  metaKey: "token_meta",
});

client.use(
  createAuthMiddleware({
    store,
    refreshLeewayMs: 60_000,
    refreshToken: async () => {
      // call refresh endpoint
      return { token: "new-token", expiresAt: Date.now() + 60_000 * 30 };
    },
  })
);

const res = await client.fetch("https://example.com");
```

## Notes

- `store` is required and is the only token persistence abstraction.
- `refreshToken` can return `{ token, expiresAt }` or `string`.
- Default refresh condition is `HttpError` with status 401.
- When `store` is created by `@aptx/token-store-cookie` with default options, `expiresAt` is synced to cookie `expires`.
