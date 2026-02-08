# @aptx/api-plugin-retry

Retry middleware for `@aptx/api-core`.

## Install

```bash
pnpm add @aptx/api-plugin-retry
```

## Usage

```ts
import { RequestClient } from "@aptx/api-core";
import { createRetryMiddleware } from "@aptx/api-plugin-retry";

const client = new RequestClient();
client.use(
  createRetryMiddleware({
    retries: 2,
    delayMs: (attempt) => attempt * 100,
    retryOn: (err) => err.name === "NetworkError",
  })
);

const res = await client.fetch("https://example.com");
```

## Options

- `retries`: number of retries (not including the initial attempt)
- `delayMs`: fixed delay or function returning delay per attempt
- `retryOn`: predicate to decide whether to retry
