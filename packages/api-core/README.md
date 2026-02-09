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
- Default components:
  - `FetchTransport`
  - `DefaultUrlResolver`
  - `DefaultBodySerializer`
  - `DefaultResponseDecoder`
  - `DefaultErrorMapper`
  - `SimpleEventBus`

## Test

```bash
pnpm --filter @aptx/api-core test
```
