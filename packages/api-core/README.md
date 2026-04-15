# @aptx/api-core

`@aptx/api-core` 是 aptx 请求体系的核心库，提供请求模型、中间件管线、默认 transport/decoder/error mapper 与事件能力。

## Install

```bash
pnpm add @aptx/api-core
```

## Quick Start

```ts
import { RequestClient } from "@aptx/api-core";

const client = new RequestClient({
  baseURL: "https://api.example.com",
  timeout: 10_000,
  headers: { "X-App": "web" }
});

const res = await client.fetch<{ items: unknown[] }>("/users", {
  method: "GET",
  query: { page: 1 }
});
```

## Core Capabilities

- `RequestClient` / `createClient`
- `Request` / `Response` / `Context`
- Middleware pipeline (`use`)
- Plugin registry (`apply`)
- Composable URL resolvers for gateway routing and baseURL resolution
- Default components:
  - `FetchTransport`
  - `DefaultUrlResolver`
  - `DefaultBodySerializer`
  - `DefaultResponseDecoder`
  - `DefaultErrorMapper`
  - `SimpleEventBus`

## Gateway Routing

```ts
import {
  RequestClient,
  DefaultUrlResolver,
  chainUrlResolvers,
  createGatewayUrlResolver,
} from "@aptx/api-core";

const client = new RequestClient({
  urlResolver: chainUrlResolvers(
    createGatewayUrlResolver({
      "/AuthorityAPI": "https://authority.example.com/root",
    }),
    new DefaultUrlResolver("https://fallback.example.com/root"),
  ),
});
```

Use URL resolvers, not middleware, for prefix-based gateway selection.

## Test

```bash
pnpm --filter @aptx/api-core test
```
