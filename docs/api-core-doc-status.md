# api-core 文档状态清单

用途：区分当前 `docs` 中哪些内容已落地，哪些仍是规划，避免文档和实现脱节。

---

## 一、已实现（代码已存在）

- `core` 基础结构：`Request` / `Response` / `Context` / `Pipeline` / `RequestClient`
- 默认实现：`FetchTransport` / `DefaultUrlResolver` / `DefaultBodySerializer` / `DefaultResponseDecoder` / `DefaultErrorMapper` / `SimpleEventBus`
- 配置能力：`baseURL` / `headers` / `timeout` / `meta` / `defaultResponseType` / `strictDecode` / `querySerializer`
- 请求级能力：header 删除（`null`）、`onUploadProgress`、`onDownloadProgress`
- 错误类型：`HttpError` / `NetworkError` / `TimeoutError` / `CanceledError` / `ConfigError` / `SerializeError` / `DecodeError`
- 扩展协作：`createBagKey` / `assertBagKey` / `ctx.bagView`
- 事件语义：`request:abort` 与 `request:error` 互斥，payload 冻结
- 官方插件：
  - `@aptx/api-plugin-retry`
  - `@aptx/api-plugin-auth`（主动刷新 + 401 被动刷新 + 单飞）
  - `@aptx/api-plugin-csrf`
- Query 适配核心（Phase 1）：
  - `@aptx/api-query-adapter`（`createQueryDefinition` / `createMutationDefinition` / `createDefaultRetryClassifier`）
- Query 框架薄适配（Phase 2）：
  - `@aptx/api-query-react`（`createReactQueryHooks` / `createReactMutationHooks`）
  - `@aptx/api-query-vue`（`createVueQueryHooks` / `createVueMutationHooks`）
- samples 已接入新适配：
  - `samples/react-app`（QueryClientProvider + adapter/react hooks）
  - `samples/vue-app`（VueQueryPlugin + adapter/vue hooks）

---

## 二、规划中（未实现）

- cache 官方插件
- observability 官方插件（如 OpenTelemetry/Sentry 封装）
  - 草案：`docs/api-plugin-observability-draft.md`
- 小程序 transport 适配
- 代码生成器接入（TanStack Query 终端产物）
  - 设计稿：`docs/api-query-adapter-design.md`
  - 模板契约草案：`docs/codegen-template-contract-draft.md`

---

## 三、建议优化/归档

- `docs/final_api_architecture.md`
  - 建议标记为“历史主方案参考”，保留不删除；当前实施以
    `docs/api-core-doc-status.md`、`docs/api-query-adapter-design.md`、
    `docs/codegen-template-contract-draft.md` 为准。
- `docs/api-query-adapter-design.md`
  - 建议持续维护为“设计 + 里程碑”文档，已实现项打标，避免再次出现“设计稿（未实现）”与现状冲突。

---

## 四、文档用途说明

- `unireq-core-v0-design`：历史设计基线文档，已移除
- `docs/api-core-extension-and-config-spec.md`：当前接入规范（主文档）
- `docs/api-core-doc-status.md`：实现状态总览（本文件）
