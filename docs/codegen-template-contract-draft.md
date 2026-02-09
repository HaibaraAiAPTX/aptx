# APTX 代码生成器模板契约草案（可迁移到生成器仓库）

用途：定义生成器如何基于 API 描述生成 `functions`、`react-query`、`vue-query` 终端代码，并约束模板输入/输出契约，确保可测试、可演进、可兼容旧项目。

状态：Draft。

---

## 1. 目标与边界

### 1.1 目标

1. 统一生成产物结构，便于跨项目复用。
2. 生成代码默认对齐：
   - `@aptx/api-client`
   - `@aptx/api-query-adapter`
   - `@aptx/api-query-react`
   - `@aptx/api-query-vue`
3. 兼容终端差异（仅生成 functions / react-query / vue-query）。

### 1.2 非目标

1. 不负责 OpenAPI 解析实现细节（由 parser 层负责）。
2. 不内置具体业务逻辑（租户、鉴权策略等）。
3. 不在模板层耦合运行时 transport（fetch/axios 由 client 装配决定）。

---

## 2. 生成器输入契约（模板上下文）

建议 parser 最终给模板层的标准上下文：

```ts
type GeneratorInput = {
  project: {
    packageName: string;
    apiBasePath?: string;
    terminals: Array<"functions" | "react-query" | "vue-query">;
    retryOwnership?: "core" | "query" | "hybrid";
  };
  endpoints: EndpointItem[];
};

type EndpointItem = {
  namespace: string[];              // e.g. ["account-category"]
  operationName: string;            // e.g. "getInfo"
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;                     // e.g. "/AccountCategory/GetInfo"
  inputTypeName: string;            // e.g. "AccountCategoryGetInfoInput"
  outputTypeName: string;           // e.g. "AccountCategoryDTOResultModel"
  requestBodyField?: string;        // e.g. "data"
  queryFields?: string[];           // e.g. ["id"]
  pathFields?: string[];            // e.g. ["id"]
  hasRequestOptions: boolean;       // 是否暴露 PerCallOptions
  supportsQuery: boolean;           // 一般 GET=true
  supportsMutation: boolean;        // 一般 非GET=true
  deprecated?: boolean;
};
```

模板层不应再解析 OpenAPI 细节，只消费以上标准结构。

---

## 3. 输出目录契约

推荐输出：

```txt
generated/
  spec/
    endpoints/**/*
    types/**/*
  client/
    createClient.ts
    registry.ts
  api/
    functions/**/*
    react-query/**/*      (可选)
    vue-query/**/*        (可选)
```

硬规则：

1. one-endpoint-per-file。
2. index 文件只做 re-export，不导出聚合对象。
3. 不同 terminal 不互相 import。

---

## 4. 模板契约（必须输出的符号）

## 4.1 functions 终端

每个 endpoint 生成：

1. `xxx(input, options?) => Promise<Output>`
2. 仅依赖：
   - `getApiClient()`
   - `buildXxxSpec()`
   - 类型定义

## 4.2 react-query 终端

每个 query endpoint 生成：

1. `xxxQueryDef`（`createQueryDefinition`）
2. `xxxKey`
3. `useXxxQuery`（来自 `createReactQueryHooks`）

每个 mutation endpoint 生成：

1. `xxxMutationDef`（`createMutationDefinition`）
2. `useXxxMutation`（来自 `createReactMutationHooks`）

## 4.3 vue-query 终端

与 react-query 对齐，仅替换为 Vue hooks：

1. `xxxQueryDef` / `xxxKey` / `useXxxQuery`
2. `xxxMutationDef` / `useXxxMutation`

---

## 5. 命名与文件规则

推荐统一：

1. Query 文件：`{operation}.query.ts`
2. Mutation 文件：`{operation}.mutation.ts`
3. Functions 文件：`{operation}.ts`
4. Spec Builder：`build{PascalOperation}Spec`
5. Hook 命名：
   - `use{PascalOperation}Query`
   - `use{PascalOperation}Mutation`

示例：

1. `getInfo` -> `getInfo.query.ts` + `useGetInfoQuery`
2. `edit` -> `edit.mutation.ts` + `useEditMutation`

---

## 6. 关键行为契约

1. Query `signal` 必须透传到 `PerCallOptions.signal`。
2. Query `meta` 必须透传（建议放 `meta.__query`）。
3. `queryKey` 必须稳定（keyPrefix + normalizedInput）。
4. GET 默认生成 query 终端；非 GET 默认生成 mutation 终端。
5. 若 endpoint 标记 deprecated，生成注释但不阻止产出。

---

## 7. 示例输入与输出文件对

## 7.1 示例输入（JSON）

```json
{
  "project": {
    "packageName": "@demo/api",
    "terminals": ["functions", "react-query", "vue-query"],
    "retryOwnership": "core"
  },
  "endpoints": [
    {
      "namespace": ["account-category"],
      "operationName": "getInfo",
      "method": "GET",
      "path": "/AccountCategory/GetInfo",
      "inputTypeName": "AccountCategoryGetInfoInput",
      "outputTypeName": "AccountCategoryDTOResultModel",
      "queryFields": ["id"],
      "hasRequestOptions": true,
      "supportsQuery": true,
      "supportsMutation": false
    },
    {
      "namespace": ["account-category"],
      "operationName": "edit",
      "method": "PUT",
      "path": "/AccountCategory/Edit",
      "inputTypeName": "EditAccountCategoryRequestModel",
      "outputTypeName": "ResultModel",
      "requestBodyField": "data",
      "hasRequestOptions": true,
      "supportsQuery": false,
      "supportsMutation": true
    }
  ]
}
```

## 7.2 输出文件对 A：functions/getInfo

文件：`generated/api/functions/account-category/getInfo.ts`

```ts
import type { PerCallOptions } from "../../../client/client";
import { getApiClient } from "../../../client/registry";
import { buildGetInfoSpec } from "../../../../spec/endpoints/account-category/getInfo";
import type { AccountCategoryGetInfoInput } from "../../../../spec/types/AccountCategoryGetInfoInput";
import type { AccountCategoryDTOResultModel } from "../../../../spec/types/AccountCategoryDTOResultModel";

export function getInfo(
  input: AccountCategoryGetInfoInput,
  options?: PerCallOptions
): Promise<AccountCategoryDTOResultModel> {
  return getApiClient().execute<AccountCategoryDTOResultModel>(buildGetInfoSpec(input), options);
}
```

## 7.3 输出文件对 B：react-query/getInfo.query

文件：`generated/api/react-query/account-category/getInfo.query.ts`

```ts
import { createQueryDefinition } from "@aptx/api-query-adapter";
import { createReactQueryHooks } from "@aptx/api-query-react";
import { getApiClient } from "../../../client/registry";
import { buildGetInfoSpec } from "../../../../spec/endpoints/account-category/getInfo";
import type { AccountCategoryGetInfoInput } from "../../../../spec/types/AccountCategoryGetInfoInput";
import type { AccountCategoryDTOResultModel } from "../../../../spec/types/AccountCategoryDTOResultModel";

export const getInfoQueryDef = createQueryDefinition<AccountCategoryGetInfoInput, AccountCategoryDTOResultModel>({
  keyPrefix: ["account-category", "getInfo"] as const,
  buildSpec: buildGetInfoSpec,
  execute: (spec, options) => getApiClient().execute(spec, options),
});

export const getInfoKey = getInfoQueryDef.key;

export const { useAptxQuery: useGetInfoQuery } = createReactQueryHooks(getInfoQueryDef);
```

## 7.4 输出文件对 C：vue-query/getInfo.query

文件：`generated/api/vue-query/account-category/getInfo.query.ts`

```ts
import { createQueryDefinition } from "@aptx/api-query-adapter";
import { createVueQueryHooks } from "@aptx/api-query-vue";
import { getApiClient } from "../../../client/registry";
import { buildGetInfoSpec } from "../../../../spec/endpoints/account-category/getInfo";
import type { AccountCategoryGetInfoInput } from "../../../../spec/types/AccountCategoryGetInfoInput";
import type { AccountCategoryDTOResultModel } from "../../../../spec/types/AccountCategoryDTOResultModel";

export const getInfoQueryDef = createQueryDefinition<AccountCategoryGetInfoInput, AccountCategoryDTOResultModel>({
  keyPrefix: ["account-category", "getInfo"] as const,
  buildSpec: buildGetInfoSpec,
  execute: (spec, options) => getApiClient().execute(spec, options),
});

export const getInfoKey = getInfoQueryDef.key;

export const { useAptxQuery: useGetInfoQuery } = createVueQueryHooks(getInfoQueryDef);
```

## 7.5 输出文件对 D：react-query/edit.mutation

文件：`generated/api/react-query/account-category/edit.mutation.ts`

```ts
import { createMutationDefinition } from "@aptx/api-query-adapter";
import { createReactMutationHooks } from "@aptx/api-query-react";
import { getApiClient } from "../../../client/registry";
import { buildEditSpec } from "../../../../spec/endpoints/account-category/edit";
import type { EditAccountCategoryRequestModel } from "../../../../spec/types/EditAccountCategoryRequestModel";
import type { ResultModel } from "../../../../spec/types/ResultModel";

export const editMutationDef = createMutationDefinition<EditAccountCategoryRequestModel, ResultModel>({
  buildSpec: buildEditSpec,
  execute: (spec, options) => getApiClient().execute(spec, options),
});

export const { useAptxMutation: useEditMutation } = createReactMutationHooks(editMutationDef);
```

---

## 8. 向下兼容（旧 axios 风格项目）

若需要保留旧风格函数签名（例如 `AccountCategoryGetInfo(id)`）：

1. 由 parser 层生成更窄的 `inputType`（例如仅 `{ id: string }`）。
2. 模板层仍输出统一 `functions/query/mutation` 结构。
3. 可选增加 `legacy-axios` terminal（单独模板）用于渐进迁移。

---

## 9. 模板自检清单（CI 建议）

1. 模板 snapshot 测试（固定输入 -> 固定输出）。
2. 生成产物 `tsc --noEmit`。
3. 终端示例项目 build（react + vue）。
4. lint 规则校验（禁止 terminal 互相依赖）。

---

## 10. 实施建议（在生成器仓库）

1. 先实现最小模板集：
   - `functions`
   - `react-query`（query + mutation）
2. 跑通一个真实 endpoint。
3. 再扩展 `vue-query`。
4. 最后追加 `legacy-axios` 兼容模板（如需要）。
