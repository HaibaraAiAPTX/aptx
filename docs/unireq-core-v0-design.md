# 通用渐进式增强请求框架（Core v0）设计汇总

## 一、最初设想（设计目标）

### 1. 总体目标
设计一款 **渐进式增强（Progressive Enhancement）** 的通用前端请求框架，满足以下条件：

- **跨框架使用**：不依赖 React / Vue / Svelte 等具体前端框架
- **fetch 风格 API**：贴近原生 fetch 的心智模型
- **面向对象设计（OO）**：通过接口与组合进行扩展
- **高度可定制**：不同项目可通过实现接口或插件定制行为
- **核心最小化**：core 层只定义“框架 + 关键抽象点”

### 2. 明确的设计边界
core 层 **只负责**：
- 请求生命周期框架
- 请求关键抽象（Request / Response / Context）
- 扩展机制（Middleware / Plugin）
- 一个最小可用的网络实现（FetchTransport）

core 层 **不负责**：
- 缓存
- 重试策略
- 认证 / token 刷新
- 状态管理
- 框架绑定（hooks / composables）

---

## 二、核心设计决策（已拍板）

### 1. API 风格
- 采用 **fetch 风格**
- 默认自动 decode 响应数据（方案 A）
- 同时保留 `raw`（底层 Response）作为逃生口

### 2. Middleware 模型
- 使用 **Onion Model（koa 风格）**
- 所有增强能力（retry / auth / cache / observability）均通过 middleware 接入

### 3. 不可变对象
- `Request` / `Response` 均为不可变对象
- 中间件通过 `req.with(...)` 创建新 Request

### 4. Context.bag
- 使用 `Map<symbol, unknown>`
- 仅用于 **单次请求生命周期内的插件协作**
- 明确禁止存放跨请求或全局状态

### 5. Core 内置内容
- 仅内置：
  - FetchTransport
  - 默认 UrlResolver
  - 默认 BodySerializer
  - 默认 ResponseDecoder
  - 默认 ErrorMapper
- 所有“高级能力”通过插件实现

---

## 三、核心对象模型（Core v0）

### 1. Request
- method / url / headers / query / body
- timeoutMs / signal
- meta（请求意图层，如 responseType、tag）

### 2. Response
- status / headers / url
- data（已 decode）
- raw（底层 Response）
- meta（结果附加信息，如 fromCache）

### 3. Context
- id（requestId）
- attempt（重试次数）
- startTime
- signal（统一 AbortSignal）
- bag（Map<symbol, unknown>）

Context 是“请求执行期状态容器”，不属于对外 API。

---

## 四、关键扩展点接口

### 1. Middleware（核心扩展机制）
```ts
handle(req, ctx, next): Promise<Response>
```

### 2. Transport
- 唯一真正发起网络请求的接口
- 内置 FetchTransport
- 可替换为 Axios / 小程序 / Mock

### 3. UrlResolver
- 处理 baseURL / query 拼接 / 环境切换

### 4. Serializer / Decoder / ErrorMapper
- 请求体序列化
- 响应解码
- 错误统一映射

### 5. EventBus
- request:start / end / error / abort
- 用于可观测性，不绑定具体实现

---

## 五、Context.bag 的设计与用途

### 设计原则
- 仅存放 **请求级别执行状态**
- key 必须是 `symbol`
- 插件只能读写自己定义的 key
- 跨插件协作需显式协议

### 典型使用场景
- RetryMiddleware：记录 retry 次数
- AuthMiddleware：标记是否已 refresh
- CacheMiddleware：标记 cache hit
- Observability：traceId / timing 信息

---

## 六、Core v0 当前实现状态

### 已完成
- Request / Response / Context 定义
- Onion Middleware Pipeline
- FetchTransport（内置最小网络实现）
- DefaultUrlResolver
- DefaultBodySerializer
- DefaultResponseDecoder（自动 decode）
- DefaultErrorMapper
- SimpleEventBus
- RequestClient（fetch / request API）
- Plugin Registry 骨架
- 示例 LoggerMiddleware

### 已验证能力
- 可直接作为 fetch 替代使用
- 可通过 middleware 实现功能增强
- 可在任何前端/运行时环境中复用

---

## 七、下一阶段规划（v0.1+）

### 官方插件示例
- RetryMiddleware（带策略接口）
- TimeoutMiddleware（精确 TimeoutError）
- AuthMiddleware（单飞 refresh 骨架）
- CacheMiddleware（memory / storage 抽象）

### 生态扩展
- Framework adapters（React / Vue）
- TanStack Query 适配层
- OpenTelemetry / Sentry 集成

---

## 八、核心设计哲学总结

> Core 不提供“能力”，只提供“能力接入的结构”。

- 所有复杂性通过插件叠加
- 所有状态限定在请求生命周期
- 所有扩展点都有明确边界
- 优先组合，其次继承

---

**该文档对应当前 Core v0 的设计与实现状态，可作为后续演进与协作的基准文档。**
