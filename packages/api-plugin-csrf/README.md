# @aptx/api-plugin-csrf

CSRF middleware for `@aptx/api-core`.

## Install

```bash
pnpm add @aptx/api-plugin-csrf
```

## Usage

```ts
import { RequestClient } from "@aptx/api-core";
import { createCsrfMiddleware } from "@aptx/api-plugin-csrf";

const client = new RequestClient();
client.use(
  createCsrfMiddleware({
    cookieName: "XSRF-TOKEN",
    headerName: "X-XSRF-TOKEN",
    sameOriginOnly: true,
  })
);
```

## Options

- `cookieName`: CSRF cookie name (default `XSRF-TOKEN`)
- `headerName`: header name (default `X-XSRF-TOKEN`)
- `sameOriginOnly`: only attach token for same-origin requests (default `true`)
- `getCookie`: custom cookie reader (useful for SSR/Node)
