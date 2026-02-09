# Samples

本目录提供多端接入 `@aptx` 请求库的最小示例：

- `api-server`：本地接口服务（给其他示例调用）
- `react-app`：React + Vite 示例
- `vue-app`：Vue + Vite 示例
- `ssr-node`：Node SSR 示例
- `next-ssr-auth`：Next.js + SQLite 登录隔离验证
- `miniprogram`：小程序 transport 适配示例

## Quick Start

先启动接口服务：

```bash
pnpm --filter @aptx/sample-api-server dev
```

然后按需启动任意端（`next-ssr-auth` 依赖上面的 api-server）：

```bash
pnpm --filter @aptx/sample-react-app dev
pnpm --filter @aptx/sample-vue-app dev
pnpm --filter @aptx/sample-ssr-node dev
pnpm --filter @aptx/sample-next-ssr-auth dev
# Playwright E2E（自动拉起 api-server + next）
pnpm --filter @aptx/sample-next-ssr-auth test:isolation
pnpm --filter @aptx/sample-miniprogram check
```
