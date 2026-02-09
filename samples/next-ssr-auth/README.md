# Next SSR Auth Sample

该示例用于验证同一个 SSR 应用在不同浏览器会话下不会串数据。
Next 侧通过以下包访问 `samples/api-server`：

- `@aptx/api-core`
- `@aptx/api-client`
- `@aptx/api-plugin-auth`
- `@aptx/token-store-ssr-cookie`

## 账号

- `user_a / pass_a`
- `user_b / pass_b`

## 启动

```bash
pnpm --filter @aptx/sample-api-server dev
pnpm --filter @aptx/sample-next-ssr-auth dev
```

访问 `http://localhost:3400`。

## 验证步骤

1. 浏览器 A 登录 `user_a`
2. 浏览器 B（无痕窗口也可）登录 `user_b`
3. 在 A/B 分别刷新页面，观察 `Current User` 是否保持各自身份
4. 对比 `Cookie SID` 和 `Session Table`，确认是不同会话

## 自动化验证

```bash
pnpm --filter @aptx/sample-next-ssr-auth test:isolation
```

该命令是 Playwright E2E，用例在 `tests/e2e/isolation.spec.ts`，会自动：

1. 启动 `sample-api-server`（默认 `3110`）
2. 启动 `next-ssr-auth`（默认 `3410`）
3. 模拟两个独立浏览器会话登录 A/B 账号并刷新校验
4. 输出 pass/fail 并自动关闭进程

可视化调试：

```bash
pnpm --filter @aptx/sample-next-ssr-auth test:isolation:ui
```
