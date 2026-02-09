# @aptx/api-query-react

React Query thin wrappers for definitions from `@aptx/api-query-adapter`.

## Install

```bash
pnpm add @aptx/api-query-react @aptx/api-query-adapter @tanstack/react-query
```

## Usage

```ts
import { createReactQueryHooks } from "@aptx/api-query-react";

const { useAptxQuery: useListUsers } = createReactQueryHooks(listUsersQueryDef);
```

## Exports

- `createReactQueryHooks`
- `createReactMutationHooks`
