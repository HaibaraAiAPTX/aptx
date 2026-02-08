# api-core 文档状态清单

用途：区分当前 `docs` 中哪些内容已落地，哪些仍是规划，避免文档和实现脱节。

---

## 一、已实现（代码已存在）

- `core` 基础结构：`Request` / `Response` / `Context` / `Pipeline` / `RequestClient`
- 默认实现：`FetchTransport` / `DefaultUrlResolver` / `DefaultBodySerializer` / `DefaultResponseDecoder` / `DefaultErrorMapper` / `SimpleEventBus`
- 配置能力：`baseURL` / `headers` / `timeoutMs` / `meta` / `defaultResponseType` / `strictDecode` / `querySerializer`
- 请求级能力：header 删除（`null`）、`onUploadProgress`、`onDownloadProgress`
- 错误类型：`HttpError` / `NetworkError` / `TimeoutError` / `CanceledError` / `ConfigError` / `SerializeError` / `DecodeError`
- 扩展协作：`createBagKey` / `assertBagKey` / `ctx.bagView`
- 事件语义：`request:abort` 与 `request:error` 互斥，payload 冻结
- 官方插件：
  - `@aptx/api-plugin-retry`
  - `@aptx/api-plugin-auth`（主动刷新 + 401 被动刷新 + 单飞）
  - `@aptx/api-plugin-csrf`

---

## 二、规划中（未实现）

- cache 官方插件
- observability 官方插件（如 OpenTelemetry/Sentry 封装）
- 小程序 transport 适配
- framework adapters（React/Vue）
- TanStack Query 适配层

---

## 三、文档用途说明

- `docs/unireq-core-v0-design.md`：历史设计基线（保留）
- `docs/api-core-extension-and-config-spec.md`：当前接入规范（主文档）
- `docs/api-core-doc-status.md`：实现状态总览（本文件）
