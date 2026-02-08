# 最终版前端 API 分层与生成方案（单端 & 多端统一）

> 本文档是**唯一有效方案**。  
> 目标：在 **不感知 client 的前提下**，同时满足  
> - 单项目（运行终端明确、代码风格固定）  
> - Monorepo / 多端项目（注册不同 client 即可复用）  
> - 强 TypeScript 类型提示  
> - 单次 API 调用可覆盖请求配置  
> - 对 tree-shaking 极度友好（尤其小程序）

---

## 1. 核心设计结论（一句话版）

- **Spec 负责“描述 API 是什么”**
- **Client 负责“请求怎么发”**
- **API 负责“业务怎么用”（函数/Hooks 等）**
- **业务侧永远只接触 API**
- **client 只在应用启动时注册一次，业务侧无感知**
- **一个 API 终端 = 一种对外 API 风格**
- **绝不在同一命名空间里同时暴露 data API 与 hooks API**

> 重要澄清：本文提到的“全局注册 client 风险（SSR/测试）”指的是 **服务端渲染（SSR）进程内的全局状态**。  
> 纯浏览器 CSR 场景（代码只在用户浏览器进程运行）使用全局注册通常没问题。

---

## 2. 分层架构总览

```
[ 业务 / 页面 ]
        ↓
[ API（对外：纯函数 / React hooks / Vue hooks / 小程序资源）]
        ↓
[ Client（执行：client 注册与执行）]
        ↓
[ Spec（描述：endpoint spec + 类型 + buildSpec）]
```

### 各层职责边界

| 层级 | 是否生成 | 是否暴露给业务 | 是否与框架相关 |
|----|----|----|----|
| Spec | 必生成 | ❌ | ❌ |
| Client | 必生成 | ❌ | ❌ |
| API | 按终端生成 | ✅ | ✅ |

---

## 3. 目录结构（tree-shaking 强约束）

```
generated/
  spec/
    types/
    endpoints/          # one-endpoint-per-file
    shared/             # 框架无关工具（queryKey 等）
  client/
    client.ts           # ApiClient 接口定义
    registry.ts         # setApiClient / getApiClient
  api/
    functions/          # 纯函数 API（默认、通用）
    react-query/        # React Query API（可选）
    vue-query/          # Vue Query API（可选）
    miniapp/            # 小程序 API（可选）
```

### 硬性规则
- **每个 endpoint / hook 单文件**
- **禁止任何聚合对象导出**
- **index.ts 只能 re-export**
- **不同 terminal 绝不互相 re-export**

---

## 4. Spec 层（框架无关）

### 4.1 Endpoint 描述

```ts
// spec/endpoints/user/listUsers.ts
export function buildListUsersSpec(input: UserListInput): RequestSpec {
  return {
    method: 'GET',
    path: '/users',
    query: { page: input.page }
  }
}
```

### 4.2 RequestSpec（只描述，不执行）

```ts
type RequestSpec = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  query?: Record<string, any>
  headers?: Record<string, string>
  body?: unknown
}
```

> Spec 层 **永远不 import fetch / axios / wx.request / react-query**。

---

## 5. Client 层（client 注册）

### 5.1 ApiClient 接口

```ts
export type ApiClient = {
  execute<T>(
    spec: RequestSpec,
    options?: PerCallOptions
  ): Promise<T>
}
```

### 5.2 PerCallOptions（单次调用覆盖）

```ts
export type PerCallOptions = {
  headers?: Record<string, string>
  query?: Record<string, any>
  timeoutMs?: number
  signal?: AbortSignal
  bag?: Record<string, any>
  meta?: Record<string, any>
}
```

说明：
- `PerCallOptions` 只用于“覆盖请求参数/传递元数据”。重试、鉴权、CSRF 等行为建议通过 client 的 middleware/plugin 装配。
- 若确实需要“单次影响重试策略”，建议通过 `meta` 传递开关或策略，由重试插件读取并应用（避免在 Client 层重复实现重试逻辑）。
  - 例如：`meta: { __aptxRetry: { retries: 0 } }` 表示本次调用禁用重试（需要重试插件支持该 meta 约定）。

### 5.3 ApiClient 注册（应用启动时）

```ts
setApiClient(client)
```

业务侧 **永远不感知 client 的存在**。

#### 5.3.1 为什么 SSR 下不推荐“服务端全局注册”

你提到的理解是对的：如果你的 terminal 只在浏览器运行，那么“全局注册”是注册在用户浏览器的全局环境里，不会发生跨用户串数据。

问题出在 SSR：SSR 的“应用启动”发生在 **Node/Server 进程启动时**，这个进程会同时处理很多用户请求。此时如果你把 `client` 放在进程级全局变量里：

- A 用户请求开始渲染时设置了全局 client（例如携带 A 用户 cookie/token 的 store）
- B 用户请求同时进入并覆盖了全局 client
- A 用户渲染过程中再次调用 terminal 时读到的是 B 的 client

因此：**SSR 推荐使用“request-scope runtime”**，而不是服务端 `setApiClient`。

推荐形态（SSR/测试更稳，业务仍然不需要每次传 client）：

```ts
// runtime: 创建一个 runtime 实例（不走进程全局）
export function createApiClientScope(client: ApiClient) {
  return { execute: client.execute.bind(client) }
}

// terminal: 绑定 runtime，返回可调用 API
export function createApiFunctions(scope: ReturnType<typeof createApiClientScope>) {
  return {
    listUsers: (input: UserListInput, options?: PerCallOptions) =>
      scope.execute<UserListOutput>(buildListUsersSpec(input), options),
  }
}
```

客户端 CSR 可以仍用 `setApiClient`（更简单）；SSR 则在每个 request 内创建自己的 API 实例并注入到渲染上下文。

---

## 6. API 层（对外 API 风格）

### 6.1 纯函数 API（functions）

```ts
export function listUsers(
  input: UserListInput,
  options?: PerCallOptions
): Promise<UserListOutput>
```

使用示例：

```ts
await listUsers({ page: 1 }, { timeoutMs: 1200 })
```

### 6.2 React Query 终端（示例）

```ts
export function useListUsers(
  input: UserListInput,
  options?: {
    request?: PerCallOptions
    rq?: UseQueryOptions
  }
)
```

> React/Vue/SWR 等 API **只在各自目录中生成和导出**。

---

## 7. 参考实现（生成代码长什么样）

目标：**所有 api 相关代码全部生成**；用户只做两件事：
1. 创建并注册 `ApiClient`（CSR）或在 SSR request 内创建一份（SSR）
2. 提供 `TokenStore`（浏览器 cookie store 或 SSR request-scoped store）

下面是推荐的“生成产物骨架”，生成器可以直接照着落盘。

### 7.1 `generated/spec`（每个 endpoint 单文件）

```ts
// generated/spec/endpoints/user/listUsers.ts
import type { RequestSpec } from "../../client/client";
import type { UserListInput } from "../../spec/types/UserListInput";

export function buildListUsersSpec(input: UserListInput): RequestSpec {
  return {
    method: "GET",
    path: "/users",
    query: { page: input.page },
  };
}
```

### 7.2 `generated/client`（统一装配：api-core + plugins）

```ts
// generated/client/createClient.ts
import { RequestClient } from "@aptx/api-core";
import { createAuthMiddleware } from "@aptx/api-plugin-auth";
import { createRetryMiddleware } from "@aptx/api-plugin-retry";
import type { TokenStore } from "@aptx/token-store";
import { createAptxCoreApiClient, type ApiClient } from "@aptx/api-client";

export type CreateClientOptions = {
  baseURL: string;
  tokenStore?: TokenStore;
  refreshToken?: () => Promise<{ token: string; expiresAt?: number } | string>;
};

export function createClient(opts: CreateClientOptions): ApiClient {
  const rc = new RequestClient({ baseURL: opts.baseURL, timeoutMs: 10_000 });

  // optional: retry (global default)
  rc.use(
    createRetryMiddleware({
      retries: 2,
      retryOn: (err, req) => req.method === "GET" && (err.name === "NetworkError" || err.name === "TimeoutError"),
    }),
  );

  // optional: auth (only if store+refreshToken provided)
  if (opts.tokenStore && opts.refreshToken) {
    rc.use(
      createAuthMiddleware({
        store: opts.tokenStore,
        refreshToken: opts.refreshToken,
      }),
    );
  }

  return createAptxCoreApiClient(rc);
}
```

```ts
// generated/client/registry.ts
export { setApiClient, getApiClient, clearApiClient } from "@aptx/api-client";
```

约定（单次影响重试）：
```ts
// generated/client/retryMeta.ts
export type RetryOverride = { disable?: boolean; retries?: number };
export const retryMeta = (v: RetryOverride) => ({ __aptxRetry: v });
```

### 7.3 `generated/api/functions`（业务直接调用的 data API）

```ts
// generated/api/functions/user/listUsers.ts
import type { PerCallOptions } from "../../client/client";
import { getApiClient } from "../../client/registry";
import { buildListUsersSpec } from "../../../spec/endpoints/user/listUsers";
import type { UserListInput } from "../../../spec/types/UserListInput";
import type { UserListOutput } from "../../../spec/types/UserListOutput";

export function listUsers(input: UserListInput, options?: PerCallOptions): Promise<UserListOutput> {
  return getApiClient().execute<UserListOutput>(buildListUsersSpec(input), options);
}
```

### 7.4 `generated/api/react-query`（可选，按文件生成 hooks）

```ts
// generated/api/react-query/user/useListUsers.ts
import { useQuery } from "@tanstack/react-query";
import type { PerCallOptions } from "../../client/client";
import { listUsers } from "../../api/functions/user/listUsers";
import type { UserListInput } from "../../../spec/types/UserListInput";

export function listUsersKey(input: UserListInput) {
  return ["user", "listUsers", input] as const;
}

export function useListUsers(
  input: UserListInput,
  opts?: { request?: PerCallOptions; rq?: Parameters<typeof useQuery>[0] },
) {
  return useQuery({
    queryKey: listUsersKey(input),
    queryFn: () => listUsers(input, opts?.request),
    ...(opts?.rq as any),
  });
}
```

---

## 8. 使用方式（CSR / SSR）

### 8.1 CSR（浏览器）

```ts
import { createClient } from "./generated/client/createClient";
import { setApiClient } from "./generated/client/registry";

setApiClient(
  createClient({
    baseURL: "/api",
    tokenStore: /* 浏览器 TokenStore，如 @aptx/token-store-cookie */,
    refreshToken: async () => ({ token: "...", expiresAt: Date.now() + 3600_000 }),
  }),
);

// 页面中直接调用
// await listUsers({ page: 1 })
```

### 8.2 SSR（每个 request 创建一份，不做进程全局注册）

SSR 下推荐把 client 注入到“本次 request 的上下文”，不要用 `setApiClient`。
实现方式有多种（Next.js/Nuxt/自建 SSR），核心是：**每个 request 都创建 tokenStore/client，并把 api 函数绑定到这个 client 上**。

生成器可以额外生成一个“scoped 入口”，用于 SSR：

```ts
// generated/api/functions/scoped.ts
import type { ApiClient, PerCallOptions } from "../client/client";
import { buildListUsersSpec } from "../../spec/endpoints/user/listUsers";
import type { UserListInput } from "../../spec/types/UserListInput";
import type { UserListOutput } from "../../spec/types/UserListOutput";

export function createApi(scopeClient: ApiClient) {
  return {
    listUsers: (input: UserListInput, options?: PerCallOptions) =>
      scopeClient.execute<UserListOutput>(buildListUsersSpec(input), options),
  };
}
```

SSR request 内：
```ts
const client = createClient({ baseURL: "http://internal-api", tokenStore: /* SSR store */, refreshToken: /* optional */ });
const api = createApi(client);
await api.listUsers({ page: 1 });
```

这样 CSR 仍是“全局无感”；SSR 是“request-scope”，两者都不需要业务写 `if (isBrowser)` 分支。

---

## 7. 单端项目 vs 多端项目

### 7.1 单端项目（运行终端明确）

- **只生成并导出该 API 终端**
- 例如：
  - React 项目：`api/react-query`
  - 小程序项目：`api/functions`
- 其他终端代码 **不生成或不导出**
- 天然不会出现无用代码被打包

### 7.2 多端项目（Monorepo）

- Spec + Client 共享
- 每个端：
  - 注册自己的 client
  - 只 import 自己的 API 终端
- client 不同，API 行为不同，**代码完全复用**

---

## 8. Tree-shaking 保证清单

必须满足以下所有条件：

1. one-endpoint-per-file / one-hook-per-file
2. 允许“聚合入口”，但要区分两类：
   - 推荐：`index.ts` 仅 re-export（`export { listUsers } from "./listUsers"`），tree-shaking 友好
   - 谨慎：导出对象聚合（`export const api = { ... }`），多数 bundler 难以做“对象属性级别”摇树
3. api 入口隔离
4. 业务只 import 需要的 api 终端
5. monorepo：`exports` 子路径隔离 + `sideEffects: false`
6. 单项目：lint 限制跨 api 终端导入

---

## 9. 最终业务体验（你想要的样子）

```ts
// 不感知 client
const data = await listUsers({ page: 1 })

// 单次覆盖请求配置
await listUsers({ page: 1 }, { headers: { 'x-trace': id } })

// React
const q = useListUsers({ page: 1 })
```

---

## 10. 拍板结论

- **这是最终方案，不再需要其他风格文档**
- **生成器只需要围绕这三层落盘**
- **是否 monorepo / 单项目，只影响“生成哪些 terminal”，不影响 Core**
- **client 永远是运行时概念，不是 API 概念**

> 这套方案可以直接作为你 Rust 代码生成器的“目标规格”。
