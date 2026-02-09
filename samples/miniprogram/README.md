# Mini Program Sample

该示例展示如何在小程序环境中把 `wx.request` 适配为 `@aptx/api-core` 的 `Transport`。

核心文件：

- `src/index.ts`：`WxTransport` 实现 + `createMiniProgramApiClient`
- `src/wx.d.ts`：最小 `wx.request` 类型声明（仅用于示例类型检查）

运行类型检查：

```bash
pnpm --filter @aptx/sample-miniprogram check
```
