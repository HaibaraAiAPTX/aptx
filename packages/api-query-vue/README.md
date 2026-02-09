# @aptx/api-query-vue

Vue Query thin wrappers for definitions from `@aptx/api-query-adapter`.

## Install

```bash
pnpm add @aptx/api-query-vue @aptx/api-query-adapter @tanstack/vue-query vue
```

## Usage

```ts
import { createVueQueryHooks } from "@aptx/api-query-vue";

const { useAptxQuery: useListUsers } = createVueQueryHooks(listUsersQueryDef);
```

## Exports

- `createVueQueryHooks`
- `createVueMutationHooks`
