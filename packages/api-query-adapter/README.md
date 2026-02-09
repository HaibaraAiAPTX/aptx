# @aptx/api-query-adapter

Framework-agnostic query/mutation adapter utilities for `@aptx/api-client`.

## Install

```bash
pnpm add @aptx/api-query-adapter @aptx/api-client @tanstack/query-core
```

## Usage

```ts
import { createQueryDefinition } from "@aptx/api-query-adapter";
import { getApiClient } from "@aptx/api-client";

const listUsersQuery = createQueryDefinition({
  keyPrefix: ["user", "listUsers"] as const,
  buildSpec: (input: { page: number }) => ({
    method: "GET",
    path: "/users",
    query: { page: input.page },
  }),
  execute: (spec, options) => getApiClient().execute(spec, options),
});

export const listUsersKey = listUsersQuery.key;
```

## Exports

- `createQueryDefinition`
- `createMutationDefinition`
- `createDefaultRetryClassifier`

## Test

```bash
pnpm --filter @aptx/api-query-adapter test
```
