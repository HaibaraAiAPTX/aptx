# observability 官方插件草案（Draft）

用途：定义 `@aptx/api-core` 的 observability 官方插件建议方案（OpenTelemetry / Sentry 封装），用于后续实现时保持 API 与事件语义稳定。

状态：草案（未实现）。

---

## 一、目标与边界

### 目标

- 基于现有 core 事件实现 trace / metrics / error reporting。
- 提供统一插件 API，便于业务低成本接入。
- 与 `retry/auth/cache` 等插件可组合，不侵入业务逻辑。

### 非目标

- 不在 core 中增加业务逻辑。
- 不在 core 中绑定具体供应商 SDK（Sentry/Datadog 等）。
- 不在事件回调里修改请求或响应对象。

---

## 二、事件模型建议

当前 core 已有事件，作为最小必备：

- `request:start`
- `request:end`
- `request:error`
- `request:abort`

该集合通常已足够支持：
- 请求延迟、成功率、错误率、取消率
- 基础分布式追踪（span start/end + exception）

### 进阶可选事件（建议由插件侧发出）

- `request:retry`：记录重试 attempt 与原因
- `request:auth:refresh:start/end/error`：记录 token 刷新行为
- `request:cache:hit/miss`：记录缓存命中情况
- `request:decode:error` / `request:serialize:error`：细分编解码失败

说明：`retry/auth/cache` 细粒度事件建议放在对应插件中发出，避免 core 事件膨胀。

---

## 三、推荐 API 形态

按现有官方插件风格（`createXxxMiddleware` / `createXxxPlugin`）：

```ts
import type { Middleware, Plugin, Request, Response, Context } from "@aptx/api-core";

export interface ObservabilityOptions {
  serviceName?: string;
  env?: string;
  version?: string;

  injectTraceHeader?: boolean;
  traceHeaderName?: string; // 默认 "traceparent"（或按团队规范使用 "X-Trace-ID"）
  captureRequestHeaders?: string[];
  captureResponseHeaders?: string[];
  redactHeaders?: string[]; // 默认至少包含 authorization/cookie

  // 自定义标签
  getAttributes?: (req: Request, ctx: Context) => Record<string, unknown>;
}

export function createObservabilityMiddleware(options?: ObservabilityOptions): Middleware;

export interface OpenTelemetryPluginOptions extends ObservabilityOptions {
  tracer: {
    startSpan: (name: string, options?: Record<string, unknown>) => {
      setAttribute: (k: string, v: unknown) => void;
      recordException?: (err: unknown) => void;
      end: () => void;
    };
  };
  meter?: unknown;
}
export function createOpenTelemetryPlugin(options: OpenTelemetryPluginOptions): Plugin;

export interface SentryPluginOptions extends ObservabilityOptions {
  sentry: {
    captureException: (err: unknown, context?: Record<string, unknown>) => void;
    addBreadcrumb?: (breadcrumb: Record<string, unknown>) => void;
  };
  captureFailedRequest?: boolean; // default true
}
export function createSentryPlugin(options: SentryPluginOptions): Plugin;
```

---

## 四、事件映射约定（建议）

### `request:start`
- 创建 span
- 写入 `http.method`、`url.full`、`ctx.id`
- 可选注入 trace header

### `request:end`
- span 写入 `http.status_code`
- 记录 `durationMs`
- span 正常结束

### `request:error`
- span 记录异常（`recordException`）
- 上报错误平台（如 Sentry）
- 记录失败指标并结束 span

### `request:abort`
- 标记取消（如 `request.aborted=true`）
- 记录取消指标并结束 span
- 与 `request:error` 互斥

---

## 五、字段与脱敏建议

- 默认脱敏头：`authorization`、`cookie`、`set-cookie`。
- 可选采集头白名单：`x-request-id`、`x-trace-id`、`content-type`。
- `meta.tags` 可用于补充业务标签（低基数字段）。
- 避免将高基数字段（完整用户输入、动态 query 原文）直接打进 metrics 标签。

---

## 六、接入示例（草案）

```ts
import { RequestClient } from "@aptx/api-core";
// import { createOpenTelemetryPlugin } from "@aptx/api-plugin-observability-otel";
// import { createSentryPlugin } from "@aptx/api-plugin-observability-sentry";

const client = new RequestClient({ baseURL: "/api" });

// client.apply(
//   createOpenTelemetryPlugin({
//     tracer,
//     serviceName: "web-app",
//     env: "prod",
//   })
// );

// client.apply(
//   createSentryPlugin({
//     sentry: Sentry,
//     captureFailedRequest: true,
//   })
// );
```

---

## 七、落地顺序建议

1. 先实现通用 `createObservabilityMiddleware`（仅依赖 core 事件）。
2. 在其上封装 provider 插件：`otel`、`sentry`。
3. 为 `retry/auth/cache` 插件补充细粒度事件并接入观测插件。
4. 增加契约测试，确保 `abort/error` 互斥、事件 payload 不可变、span 必定结束。
