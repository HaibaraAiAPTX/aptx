# api-core 扩展协议与配置规范（面向业务系统）

目的：为业务系统提供稳定的扩展点与可配置能力，确保在不修改 core 的情况下扩展认证、重试、缓存、观测等能力。
范围：仅定义扩展协议与配置约定，不提供具体业务实现。

---

## 一、配置模型（Configuration Model）

### 1) 全局默认配置
业务系统应以“全局配置”作为 SDK 初始化的唯一入口，统一管理：

- `baseURL`：请求基础域名
- `headers`：全局公共头（如 `X-App`、`X-Env`）
- `timeoutMs`：默认超时
- `defaultResponseType`：默认响应类型（如 `json`）
- `strictDecode`：是否强制解码
- `querySerializer`：自定义 query 序列化器（可选）
- `transport`：运行时适配（浏览器 / Node / 小程序）
- `errorMapper`：统一错误映射（可选）

**建议实践**
- 业务系统只暴露一个 `createClient(config)`，内部注入 `RequestClientOptions`。
- core 已提供 `createClient` helper，可直接复用。
- 环境差异通过 `transport` 适配，避免在业务层散落 runtime 判断。

---

## 二、请求级覆盖策略（Request Override）

每个请求可覆盖全局配置，建议遵循以下合并原则：

- `headers`：**合并覆盖**（新增/覆盖全局头）
- `timeoutMs`：**请求级优先**
- `responseType`：**请求级优先**
- `meta`：**浅合并**（业务协议字段，如 `tags`）

**删除 Header 的语义**
- 约定：`headers: { "X-Token": null }` 表示删除该头。

**进度回调（请求级）**
- `onUploadProgress` / `onDownloadProgress` 可在单次请求中配置。
- FetchTransport 中上传进度为 best-effort（仅对可计算大小的 body 触发一次）。
- 下载进度通过读取响应流并重建 Response 实现。

---

## 三、扩展机制（Extension Mechanism）

### 1) Middleware 是唯一扩展入口
所有能力增强应通过 Middleware 注入，业务系统不得修改 core：

- 认证（token refresh）
- 重试（策略、退避）
- 缓存（memory/storage）
- 观测（trace/log/metrics）

**示例约定**
- 认证：在 request 阶段注入头；在 error 阶段处理 401 并刷新。
- 重试：使用官方插件 `@aptx/api-plugin-retry`（推荐），或自定义 middleware。

### 2) 插件协议（Plugin）
业务系统可将一组中间件打包为插件：

- 插件仅通过 `registry` 注册，不直接访问内部状态。
- 插件应保持无状态或仅使用 `Context.bag`。

---

## 四、Context.bag 协议（扩展协作）

`Context.bag` 是请求生命周期内的共享容器，用于扩展间协作。

**约定：**
- key 必须为 `symbol`，避免冲突。
- 仅存放请求级状态，不允许跨请求复用。
- 每个扩展必须只读/只写自己的 key，跨扩展必须有明确协议。
 - core 提供 `createBagKey(name)` 与 `assertBagKey(key)` 作为推荐工具。
 - 使用 `ctx.bagView` 获取只读快照，避免误修改共享状态。

**典型用途**
- `retry`：记录当前重试次数
- `auth`：记录是否已 refresh
- `cache`：标记 cache hit

---

## 五、事件协议（Event Contract）

事件用于可观测性与审计，不应承载业务逻辑。

**事件列表**
- `request:start`
- `request:end`
- `request:error`
- `request:abort`

**最小字段保证**
- `ctx.id`
- `ctx.startTime`
- `durationMs`
- `attempt`

**互斥规则**
`request:abort` 与 `request:error` 互斥。

**只读约束**
事件 payload 在 core 内部会被冻结（Object.freeze），监听方不应修改其内容。

---

## 六、错误模型契约（Error Contract）

业务系统必须只依赖以下错误类型：

- `HttpError`：含 `status`, `url`, `headers`, `bodyPreview`
- `NetworkError`
- `TimeoutError`
- `CanceledError`
- `ConfigError`
- `SerializeError`
- `DecodeError`

**建议实践**
- `retryOn` 仅对 `NetworkError` 与特定 `HttpError` 状态码生效。
- `TimeoutError` 不默认重试，需显式配置。

---

## 七、Transport 适配协议

业务系统可提供自定义 Transport，以适配不同运行时：

**最小返回字段**
- `status`（number）
- `headers`（Headers）
- `url`（string）
- `raw`（原始响应对象）

**建议实践**
- 在 Node 环境下使用 `fetch` polyfill 或自实现 transport。
- `raw` 必须可被 decoder 解码（json/text/blob/arrayBuffer）。
- 若实现进度回调，需保证多次读取时不会破坏 decoder（可通过重建 Response）。

---

## 八、默认策略建议（业务系统内）

推荐业务系统在封装层提供以下默认策略：

- 默认 `timeoutMs`（例如 10s）
- 默认 `responseType` 为 `json`
- 基础 `retry`（建议通过 `@aptx/api-plugin-retry` 注入）
- 标准 headers（如 `X-App`、`X-Env`）

---

## 九、扩展包结构建议

建议业务系统将扩展能力拆包：

- `@your-org/api-plugin-auth`
- `@your-org/api-plugin-cache`
- `@your-org/api-plugin-retry`
- `@your-org/api-plugin-obs`

每个包只暴露 `createXxxMiddleware()` 或 `createXxxPlugin()`。

当前官方插件（本仓库）：
- `@aptx/api-plugin-retry`
- `@aptx/api-plugin-auth`
- `@aptx/api-plugin-csrf`

---

## 十、推荐插件 API 规范

插件应提供统一、可组合、可测试的 API 形态，推荐如下规范：

### 1) 命名与导出
- `createXxxMiddleware(options)`：返回一个 `Middleware`
- `createXxxPlugin(options)`：返回一个 `Plugin`
- `XxxPluginOptions`：仅暴露必要配置项，避免绑定业务实体

### 2) 纯函数与可测试
- 工厂函数是纯函数，不读取运行时全局状态（如 `window/localStorage`）
- 副作用仅发生在 middleware 执行阶段
- 中间件可独立单测（输入 Request/Context，断言输出）

### 3) Context.bag 约定
- 使用 `Symbol` 作为 key
- 包内公开 `const XXX_BAG_KEY = Symbol("xxx")`，便于调试
- 只读/只写自身 key，跨插件协作需明确协议

### 4) 错误处理约定
- 插件抛出的错误必须是 `Error` 实例
- 不要吞掉 `CanceledError` 与 `TimeoutError`
- 对 `HttpError` 可依据 `status` 决策

### 5) 事件与观测
- 插件若订阅事件，只用于观测与统计
- 不能在事件回调内改变请求/响应对象

### 6) 最小示例
```ts
import type { Middleware, Request, Context } from "@repo/api-core";

export interface RetryPluginOptions {
  retries: number;
}

export function createRetryMiddleware(options: RetryPluginOptions): Middleware {
  return {
    async handle(req: Request, ctx: Context, next) {
      for (let attempt = 0; attempt <= options.retries; attempt++) {
        ctx.attempt = attempt;
        try {
          return await next(req, ctx);
        } catch (err) {
          if (attempt >= options.retries) throw err;
        }
      }
      // unreachable
      return await next(req, ctx);
    },
  };
}
```

---

## 十一、禁止事项（保持 core 纯净）

- 禁止在 core 中引入业务逻辑（认证、缓存、重试、状态管理）。
- 禁止在 core 里绑定框架（React/Vue hooks）。
- 禁止在 core 里依赖环境实现（如 window/localStorage）。
