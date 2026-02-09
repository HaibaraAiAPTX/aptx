# @aptx/api-client

`@aptx/api-client` 提供一个轻量的业务请求契约层，把业务 `spec` 映射到 `@aptx/api-core`。

## Install

```bash
pnpm add @aptx/api-client @aptx/api-core
```

## Quick Start

```ts
import { RequestClient } from "@aptx/api-core";
import { createAptxCoreApiClient } from "@aptx/api-client";

const core = new RequestClient({
  baseURL: "https://api.example.com",
  timeout: 5000
});

const api = createAptxCoreApiClient(core);

const users = await api.execute<{ items: Array<{ id: number; name: string }> }>({
  method: "GET",
  path: "/users"
});
```

## Exports

- `createAptxCoreApiClient`
- `ApiClient`
- `RequestSpec`
- `PerCallOptions`
- `setApiClient` / `getApiClient` / `clearApiClient`

## Test

```bash
pnpm --filter @aptx/api-client test
```
