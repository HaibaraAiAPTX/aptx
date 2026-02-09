# `@aptx/api-query-adapter` 与 React/Vue 适配层设计文档（Draft）

用途：定义 `@aptx/api-core` + `@aptx/api-client` 在 TanStack Query 生态下的统一适配方案，并给出代码生成器（Rust/TS）可直接落地的目标规格。

状态：部分已实现（Phase 1/2），生成器接入待实现。

已实现：

- Phase 1：`@aptx/api-query-adapter`
  - `createQueryDefinition`
  - `createMutationDefinition`
  - `createDefaultRetryClassifier`
- Phase 2：`@aptx/api-query-react` / `@aptx/api-query-vue`
  - React：`createReactQueryHooks` / `createReactMutationHooks`
  - Vue：`createVueQueryHooks` / `createVueMutationHooks`
- samples 验证：
  - `samples/react-app`
  - `samples/vue-app`

---

## 一、设计目标

1. 一套核心适配，覆盖 React Query 与 Vue Query（基于 `@tanstack/query-core`）。
2. 保持 `@aptx/api-core` 纯净，不引入框架依赖。
3. 生成器可以按“终端能力”生成最小代码，保证 tree-shaking。
4. 保留 `api-core` 现有语义：取消、错误类型、`meta`、插件协作（auth/retry/csrf）。

---

## 二、包分层与职责

### 2.1 包结构（建议）

- `@aptx/api-query-adapter`：框架无关核心（仅依赖 `@tanstack/query-core` 类型）
- `@aptx/api-query-react`：React 轻封装（依赖 `@tanstack/react-query`）
- `@aptx/api-query-vue`：Vue 轻封装（依赖 `@tanstack/vue-query`）

### 2.2 责任边界

- `api-query-adapter` 负责：
  - 把 `RequestSpec`/endpoint 构建函数映射为 `queryFn` / `mutationFn`
  - 统一 `queryKey` 构造
  - 错误重试判定辅助
  - 单次请求覆盖参数注入（`PerCallOptions`）
- React/Vue 包只负责：
  - `useQuery` / `useMutation` 等 hooks 绑定
  - 不重复请求逻辑，不复制 key 规则

---

## 三、核心 API 设计（`@aptx/api-query-adapter`）

以下接口是生成器与手写代码都可使用的稳定契约。

```ts
import type { QueryKey } from "@tanstack/query-core";
import type { ApiClient, PerCallOptions, RequestSpec } from "@aptx/api-client";

export type EndpointBuilder<TInput> = (input: TInput) => RequestSpec;

export type QueryAdapterContext = {
  signal?: AbortSignal;
  meta?: Record<string, unknown>;
};

export type RequestOverrideFactory<TInput> = (
  input: TInput,
  ctx: QueryAdapterContext
) => PerCallOptions | undefined;

export interface CreateQueryOptions<TInput, TOutput> {
  keyPrefix: readonly unknown[]; // 例如 ["user", "listUsers"]
  buildSpec: EndpointBuilder<TInput>;
  execute: (spec: RequestSpec, options?: PerCallOptions) => Promise<TOutput>;
  getRequestOptions?: RequestOverrideFactory<TInput>;
}

export interface QueryDefinition<TInput, TOutput> {
  key: (input: TInput) => QueryKey;
  queryFn: (input: TInput) => (ctx: { signal?: AbortSignal; meta?: unknown }) => Promise<TOutput>;
}

export function createQueryDefinition<TInput, TOutput>(
  options: CreateQueryOptions<TInput, TOutput>
): QueryDefinition<TInput, TOutput>;

export interface CreateMutationOptions<TInput, TOutput> {
  buildSpec: EndpointBuilder<TInput>;
  execute: (spec: RequestSpec, options?: PerCallOptions) => Promise<TOutput>;
  getRequestOptions?: RequestOverrideFactory<TInput>;
}

export function createMutationDefinition<TInput, TOutput>(
  options: CreateMutationOptions<TInput, TOutput>
): {
  mutationFn: (input: TInput) => Promise<TOutput>;
};

export type RetryClassifier = (error: unknown) => boolean;
export function createDefaultRetryClassifier(): RetryClassifier;
```

### 3.1 关键语义约定

1. `signal` 必须透传到 `PerCallOptions.signal`，确保 Query 取消能中止底层请求。
2. `meta` 可透传到 `PerCallOptions.meta`（建议挂在 `__query` 命名空间下）。
3. `keyPrefix + input` 是默认 key 规则，必须稳定、可序列化。
4. `createDefaultRetryClassifier()` 仅做“错误是否可重试”的分类，不直接控制重试次数（由 Query 层配置）。

---

## 四、Query Key 规范

### 4.1 默认规则

`[...keyPrefix, normalizedInput]`

- `keyPrefix`：固定字面量，生成时写死，例如 `["user", "listUsers"]`
- `normalizedInput`：稳定化对象（可选排序），避免因为字段顺序导致缓存抖动

### 4.2 规范约束

1. 禁止把 `Date/Map/Set/class` 实例直接放 key。
2. `undefined` 字段应裁剪，避免 key 漂移。
3. 分页、筛选、排序字段必须进入 key。
4. 与业务身份相关但不应共享缓存的字段（如租户 ID）必须进入 key 或 meta->key 扩展。

---

## 五、错误与重试对齐策略

### 5.1 错误分类（依赖 `@aptx/api-core` 错误模型）

- 默认可重试：`NetworkError`
- 可选可重试：`TimeoutError`（建议默认 false，由业务开启）
- 条件可重试：`HttpError` 的 `429/502/503/504`
- 不重试：`CanceledError`、大多数 `4xx`

### 5.2 与 `@aptx/api-plugin-retry` 的关系

1. 若启用了 core 级 retry，Query 层建议减少 `retry` 次数，避免双重重试风暴。
2. 推荐策略：
   - core 负责网络瞬态失败（小次数）
   - Query 负责视图层重试体验（可配置）
3. 生成器应允许项目级配置：`retryOwnership = "core" | "query" | "hybrid"`。

---

## 六、React/Vue 适配层设计

## 6.1 `@aptx/api-query-react`（薄封装）

建议导出：

```ts
export function createReactQueryHooks<TInput, TOutput>(def: {
  key: (input: TInput) => readonly unknown[];
  queryFn: (input: TInput) => (ctx: { signal?: AbortSignal; meta?: unknown }) => Promise<TOutput>;
}): {
  useAptxQuery: (
    input: TInput,
    options?: {
      query?: Omit<import("@tanstack/react-query").UseQueryOptions<TOutput>, "queryKey" | "queryFn">;
    }
  ) => import("@tanstack/react-query").UseQueryResult<TOutput>;
};
```

约束：
- 只拼 `queryKey`/`queryFn`，其余选项原样透传给官方 `useQuery`。
- 不包装 `QueryClientProvider`。
- 不引入全局单例状态。

## 6.2 `@aptx/api-query-vue`（薄封装）

同样保留最小差异，仅绑定 `@tanstack/vue-query` 的 `useQuery/useMutation`，不二次抽象缓存策略。

约束：
- Vue 侧输入可支持 `MaybeRef<TInput>`，但在 key 计算前要解包并稳定化。
- 不在适配层引入 `watchEffect` 副作用逻辑，避免与用户控制冲突。

---

## 七、代码生成器落地规格（重点）

## 7.1 生成目标

按 terminal 生成，不混出：

- `generated/api/functions/**`
- `generated/api/react-query/**`（可选）
- `generated/api/vue-query/**`（可选）

保持 one-endpoint-per-file / one-hook-per-file。

## 7.2 生成器必须关注的点

1. **导入边界**
- functions 终端不得依赖 React/Vue 包
- react/vue 终端不得相互依赖

2. **请求取消**
- 生成的 queryFn 必须接收 Query 的 `signal` 并传给 `execute`

3. **类型分层**
- 输入输出类型来自 `spec/types`
- query 选项类型来自各框架官方库
- 不在生成代码里使用 `any`（必要处用泛型约束）

4. **queryKey 可预测**
- keyPrefix 用稳定字符串字面量
- key 工厂函数与 hook 同文件导出（方便 invalidate）

5. **SSR 兼容**
- 不依赖浏览器全局对象
- 保留 scoped client 入口（每 request 创建）

6. **重试策略可配置**
- 允许项目模板配置 Query retry 默认值
- 允许关闭 Query retry（由 core retry 接管）

7. **Tree-shaking**
- 仅 re-export，不导出大对象聚合
- `package.json` 标记 `sideEffects: false`
- 子路径 exports 隔离（`./react-query/*`, `./vue-query/*`）

## 7.3 推荐生成产物示例

```ts
// generated/api/react-query/user/listUsers.query.ts
import { useQuery } from "@tanstack/react-query";
import { createQueryDefinition } from "@aptx/api-query-adapter";
import { getApiClient } from "../../client/registry";
import { buildListUsersSpec } from "../../../spec/endpoints/user/listUsers";

export const listUsersQuery = createQueryDefinition({
  keyPrefix: ["user", "listUsers"] as const,
  buildSpec: buildListUsersSpec,
  execute: (spec, options) => getApiClient().execute(spec, options),
});

export const listUsersKey = listUsersQuery.key;

export function useListUsers(input: { page: number }, options?: { query?: Parameters<typeof useQuery>[0] }) {
  return useQuery({
    queryKey: listUsersQuery.key(input),
    queryFn: listUsersQuery.queryFn(input),
    ...(options?.query as object),
  });
}
```

Vue 版本结构一致，只替换 hooks 导入源。

---

## 八、实施阶段与里程碑

1. Phase 1: 实现 `@aptx/api-query-adapter` 核心函数与单测。`[DONE]`
2. Phase 2: 实现 React/Vue 薄适配包。`[DONE]`
3. Phase 3: 生成器支持 `react-query` terminal 输出。`[TODO]`
4. Phase 4: 生成器支持 `vue-query` terminal 输出。`[TODO]`
5. Phase 5: 补齐 SSR 示例（Next/Nuxt）与迁移文档。`[TODO]`

---

## 九、测试策略

1. 单测（adapter）
- key 稳定性测试
- signal 透传测试
- request/meta merge 测试
- 错误分类测试

2. 集成测试（generated）
- React Query: cancel/retry/invalidate 行为
- Vue Query: ref 输入变化触发行为
- SSR: request-scope client 不串数据

3. 回归测试（插件协同）
- 与 auth/retry/csrf 同时启用时行为一致

---

## 十、结论

最终建议：先落地 `@aptx/api-query-adapter` 作为唯一核心，再提供 React/Vue 薄层。代码生成器围绕终端输出做裁剪，重点保障取消语义、queryKey 稳定性、错误/重试一致性与 SSR 安全。
