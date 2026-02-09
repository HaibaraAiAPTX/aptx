# aptx

`aptx` 是一个基于 `pnpm workspace + turborepo` 的请求能力 monorepo，包含：

- 请求内核：`@aptx/api-core`
- 适配层：`@aptx/api-client`
- 插件：`@aptx/api-plugin-auth` / `@aptx/api-plugin-retry` / `@aptx/api-plugin-csrf`
- token 存储：`@aptx/token-store` / `@aptx/token-store-cookie` / `@aptx/token-store-ssr-cookie`
- 示例项目：`samples/*`（React / Vue / SSR Node / Next SSR / 小程序）

## 环境要求

- `Node.js >= 22.14.0`
- `pnpm 10.x`

## 安装

```bash
pnpm install
```

## 仓库结构

```text
packages/
  api-core
  api-client
  api-plugin-auth
  api-plugin-csrf
  api-plugin-retry
  token-store
  token-store-cookie
  token-store-ssr-cookie
samples/
  api-server
  react-app
  vue-app
  ssr-node
  next-ssr-auth
  miniprogram
```

## 常用命令

根目录统一命令：

```bash
pnpm dev
pnpm build
pnpm test
pnpm check-types
pnpm lint
pnpm format
```

按包执行：

```bash
pnpm --filter @aptx/api-core test
pnpm --filter @aptx/api-plugin-auth test
pnpm --filter @aptx/sample-next-ssr-auth dev
```

## Samples

先查看 `samples/README.md`，里面包含所有示例的启动方式。

常用场景：

- 启动接口服务：`pnpm --filter @aptx/sample-api-server dev`
- 启动 Next SSR 示例：`pnpm --filter @aptx/sample-next-ssr-auth dev`
- 运行 SSR 隔离 E2E：`pnpm --filter @aptx/sample-next-ssr-auth test:isolation`

## SSR 隔离验证说明

`samples/next-ssr-auth` 通过以下包访问 `samples/api-server`：

- `@aptx/api-core`
- `@aptx/api-client`
- `@aptx/api-plugin-auth`
- `@aptx/token-store-ssr-cookie`

隔离用例位于：`samples/next-ssr-auth/tests/e2e/isolation.spec.ts`
